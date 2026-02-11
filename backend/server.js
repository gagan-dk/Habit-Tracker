require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 4001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

app.use(cors());
app.use(express.json());

// Helper to generate JWT
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Auth middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Habit Tracker API running' });
});

// Register
app.post('/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: 'Email already in use' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || null,
      },
    });

    const token = generateToken(user);
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create habit
app.post('/habits', authMiddleware, async (req, res) => {
  const { title, description, frequency, startDate, category } = req.body;
  if (!title || !frequency || !startDate) {
    return res
      .status(400)
      .json({ message: 'Title, frequency and start date are required' });
  }

  try {
    const parsedStartDate = new Date(startDate);

    const habit = await prisma.habit.create({
      data: {
        title,
        description: description || null,
        frequency,
        startDate: parsedStartDate,
        category: category || null,
        userId: req.user.id,
      },
    });
    res.status(201).json(habit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all habits for user
app.get('/habits', authMiddleware, async (req, res) => {
  try {
    const habits = await prisma.habit.findMany({
      where: { userId: req.user.id, archived: false },
      orderBy: { createdAt: 'asc' },
    });
    res.json(habits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update habit
app.patch('/habits/:id', authMiddleware, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const { title, description, frequency, startDate, category, archived } =
    req.body;

  try {
    const updateData = {
      title,
      description,
      frequency,
      archived,
      category,
    };

    if (startDate) {
      updateData.startDate = new Date(startDate);
    }

    const habit = await prisma.habit.update({
      where: { id: habitId },
      data: updateData,
    });
    res.json(habit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete (archive) habit
app.delete('/habits/:id', authMiddleware, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);

  try {
    const habit = await prisma.habit.update({
      where: { id: habitId },
      data: { archived: true },
    });
    res.json(habit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark habit as completed for a date
app.post('/habits/:id/logs', authMiddleware, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);
  const { date } = req.body; // ISO string

  if (!date) {
    return res.status(400).json({ message: 'Date is required' });
  }

  const logDate = new Date(date);

  try {
    const log = await prisma.habitLog.upsert({
      where: {
        habitId_date: {
          habitId,
          date: logDate,
        },
      },
      update: { completed: true },
      create: {
        habitId,
        date: logDate,
        completed: true,
      },
    });

    res.status(201).json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get logs and basic analytics for a habit
app.get('/habits/:id/analytics', authMiddleware, async (req, res) => {
  const habitId = parseInt(req.params.id, 10);

  try {
    const habit = await prisma.habit.findUnique({
      where: { id: habitId },
    });

    if (!habit) {
      return res.status(404).json({ message: 'Habit not found' });
    }

    const logs = await prisma.habitLog.findMany({
      where: { habitId, completed: true },
      orderBy: { date: 'asc' },
    });

    // Compute simple streaks and completion stats
    let currentStreak = 0;
    let longestStreak = 0;

    if (logs.length > 0) {
      let streak = 1;
      for (let i = 1; i < logs.length; i++) {
        const prev = logs[i - 1].date;
        const curr = logs[i].date;
        const diffInDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

        if (diffInDays === 1) {
          streak += 1;
        } else {
          if (streak > longestStreak) longestStreak = streak;
          streak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, streak);
      currentStreak = streak;
    }

    // Completion rate since start date
    const today = new Date();
    const start = new Date(habit.startDate);
    const diffMs = today.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
    const totalDays = diffMs >= 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1 : 0;
    const completionRate =
      totalDays > 0 ? Math.round((logs.length / totalDays) * 100) : 0;

    res.json({
      logs,
      stats: {
        currentStreak,
        longestStreak,
        totalCompletions: logs.length,
        completionRate,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

