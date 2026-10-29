import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/middleware';

export const suggestionsRouter = Router();

const createSuggestionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  message: z.string().trim().min(3, 'Message must be at least 3 characters').max(5000, 'Message too long'),
  category: z.enum(['feature', 'improvement', 'bug', 'feedback', 'other']).default('feature'),
});

// POST /api/suggestions - Authenticated users submit a suggestion
suggestionsRouter.post('/', requireAuth, (req: Request, res: Response) => {
  const parseResult = createSuggestionSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', details: parseResult.error.format() });
    return;
  }

  const { title, message, category } = parseResult.data;
  const user = req.user!;
  const person = req.person;

  const senderName = (person?.display_name || user.email.split('@')[0] || 'User').trim();
  const senderEmail = user.email.trim();

  try {
    const insertRes = req.db.prepare(`
      INSERT INTO suggestions (
        user_id, person_id, sender_name, sender_email,
        title, message, category, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      user.id,
      person?.id || null,
      senderName,
      senderEmail,
      title,
      message,
      category
    );

    const suggestionId = Number(insertRes.lastInsertRowid);
    const created = req.db.prepare('SELECT * FROM suggestions WHERE id = ?').get(suggestionId);

    res.status(201).json({
      message: 'Suggestion submitted successfully. Thank you for your feedback!',
      suggestion: created,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

// GET /api/suggestions/my - Authenticated users view their own submitted suggestions
suggestionsRouter.get('/my', requireAuth, (req: Request, res: Response) => {
  const user = req.user!;
  try {
    const rows = req.db.prepare(`
      SELECT * FROM suggestions
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(user.id);

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: 'DATABASE_ERROR', message: err.message });
  }
});

