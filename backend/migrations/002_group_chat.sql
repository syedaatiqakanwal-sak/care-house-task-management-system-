-- Group chat schema extensions (safe for existing direct conversations).
-- Primary path for this project is still: npm run migrate (sequelize.sync alter).
-- This SQL is provided for ops/manual application if needed.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS type ENUM('direct','group') NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS name VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS description VARCHAR(500) NULL,
  ADD COLUMN IF NOT EXISTS created_by INT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE conversations
  MODIFY COLUMN user1_id INT NULL,
  MODIFY COLUMN user2_id INT NULL;

ALTER TABLE messages
  MODIFY COLUMN receiver_id INT NULL;

CREATE TABLE IF NOT EXISTS conversation_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('admin','member') NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  last_read_at TIMESTAMP NULL,
  UNIQUE KEY uniq_conversation_user (conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
