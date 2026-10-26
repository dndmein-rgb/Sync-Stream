import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
  LoginBodySchema,
  RefreshBodySchema,
  RegisterBodySchema,
} from "./auth.schema.js";
import {
  login,
  logout,
  logoutAll,
  me,
  refresh,
  register,
} from "./auth.controller.js";

const router = Router();

router.post("/register", validate(RegisterBodySchema), register);
router.post("/login", validate(LoginBodySchema), login);
router.post("/refresh", validate(RefreshBodySchema), refresh);
router.post("/logout", logout);

router.get("/me", authenticate, me);
router.post("/logout-all", authenticate, logoutAll);

export default router;