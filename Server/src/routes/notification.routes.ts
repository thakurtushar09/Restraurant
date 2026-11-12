import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import {streamNotifications,getNotifications,markNotificationRead,markAllNotificationsRead,getPushPublicKey,subscribePush,unsubscribePush,} from "../controllers/notification.controllers";

const router = Router();

router.use(isAuthenticated);
router.get("/stream", streamNotifications);
router.get("/", getNotifications);
router.patch("/read-all", markAllNotificationsRead);
router.get("/push/public-key", getPushPublicKey);
router.post("/push/subscribe", subscribePush);
router.post("/push/unsubscribe", unsubscribePush);
router.patch("/:notificationId/read", markNotificationRead);

export default router;
