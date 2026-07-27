import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Middleware to check validation results
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: 'Validation failed', details: errors.array() });
    return;
  }
  next();
};

export const validateResult = validate; // alias for new routes

export const legValidationRules = [
  body('etiology').optional().isIn(['Ep', 'Es', 'Ec', 'En']).withMessage('Invalid etiology'),
  body('ssv_diam_mm').optional().isFloat({ min: 0 }).withMessage('ssv_diam_mm must be a positive number'),
  body('cfv_status').optional().isIn(['Normal', 'Reflux', 'Obstruction', 'DVT']).withMessage('Invalid cfv_status'),
  body('femoral_v_status').optional().isIn(['Normal', 'Reflux', 'Obstruction', 'DVT']).withMessage('Invalid femoral_v_status'),
  body('popliteal_status').optional().isIn(['Normal', 'Reflux', 'Obstruction', 'DVT']).withMessage('Invalid popliteal_status'),
  body('ulcer_present_r').optional().isBoolean().withMessage('ulcer_present_r must be a boolean'),
  body('ulcer_size_r').optional().isFloat({ min: 0 }).withMessage('ulcer_size_r must be a positive number'),
  body('ulcer_present_l').optional().isBoolean().withMessage('ulcer_present_l must be a boolean'),
  body('ulcer_size_l').optional().isFloat({ min: 0 }).withMessage('ulcer_size_l must be a positive number'),
];

export const dopplerImageValidationRules = [
  body('leg_id').notEmpty().withMessage('leg_id is required').isInt().withMessage('leg_id must be an integer'),
  body('leg_side').notEmpty().withMessage('leg_side is required').isIn(['right', 'left']).withMessage('leg_side must be right or left'),
  body('phase').notEmpty().withMessage('phase is required').isIn(['deep', 'sfj_gsv', 'spj_ssv', 'accessory', 'perforator']).withMessage('Invalid phase'),
  body('segment').notEmpty().withMessage('segment is required').isString(),
  body('compressible').optional().isBoolean().withMessage('compressible must be a boolean'),
  body('spontaneous_flow').optional().isBoolean().withMessage('spontaneous_flow must be a boolean'),
  body('reflux_ms').optional().isFloat({ min: 0 }).withMessage('reflux_ms must be a positive number'),
  body('reflux_positive').optional().isBoolean().withMessage('reflux_positive must be a boolean'),
  body('diameter_mm').optional().isFloat({ min: 0 }).withMessage('diameter_mm must be a positive number'),
  body('outward_flow').optional().isBoolean().withMessage('outward_flow must be a boolean'),
];
