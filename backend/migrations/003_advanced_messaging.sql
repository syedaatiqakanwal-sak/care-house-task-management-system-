-- Advanced messaging: edit/delete/reply/forward/attachments/push preferences
-- Primary path remains: npm run migrate (sequelize.sync alter)

ALTER TABLE messages
  MODIFY COLUMN body TEXT NULL,
  ADD COLUMN IF NOT EXISTS message_type ENUM('text','image','document','mixed') NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS reply_to_message_id INT NULL,
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id INT NULL,
  ADD COLUMN IF NOT EXISTS is_forwarded TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_edited TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS edited_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS message_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  stored_file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT NOT NULL DEFAULT 0,
  storage_path VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  last_used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_push_endpoint (endpoint(255)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS desktop_notifications_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notification_sound_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notification_preview_enabled TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notify_direct_messages TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notify_group_messages TINYINT(1) NOT NULL DEFAULT 1;
