CREATE DATABASE IF NOT EXISTS letscare_all CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE letscare_all;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(80) UNIQUE NOT NULL,
  description VARCHAR(255),
  is_system TINYINT(1) DEFAULT 0,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  permission_key VARCHAR(100) UNIQUE NOT NULL,
  module VARCHAR(50) NOT NULL,
  description VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  profile_pic VARCHAR(255),
  status ENUM('active','inactive','suspended') DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  reset_token VARCHAR(255),
  reset_expires DATETIME,
  refresh_token TEXT,
  force_password_change TINYINT(1) DEFAULT 0,
  failed_login_attempts INT DEFAULT 0,
  lock_until DATETIME,
  two_factor_enabled TINYINT(1) DEFAULT 0,
  two_factor_otp VARCHAR(10),
  two_factor_expires DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  source ENUM('call','email','manual') NOT NULL,
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  status ENUM('pending','in_progress','on_hold','completed','cancelled') DEFAULT 'pending',
  assigned_to INT,
  assigned_by INT NOT NULL,
  deadline DATETIME,
  completed_at DATETIME,
  category VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE call_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT,
  caller_name VARCHAR(120),
  caller_phone VARCHAR(30),
  call_type ENUM('inbound','outbound') DEFAULT 'inbound',
  duration_sec INT DEFAULT 0,
  call_summary TEXT,
  received_by INT,
  call_datetime DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE email_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT,
  sender_name VARCHAR(120),
  sender_email VARCHAR(150),
  subject VARCHAR(255),
  body TEXT,
  received_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE task_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE task_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE task_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  changed_by INT,
  note VARCHAR(255),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('direct','group') NOT NULL DEFAULT 'direct',
  name VARCHAR(150) NULL,
  description VARCHAR(500) NULL,
  created_by INT NULL,
  user1_id INT NULL,
  user2_id INT NULL,
  last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_pair (user1_id, user2_id),
  FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE conversation_members (
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

CREATE TABLE messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id INT NOT NULL,
  receiver_id INT NULL,
  body TEXT NOT NULL,
  attachment_url VARCHAR(500),
  is_read TINYINT(1) DEFAULT 0,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(150) NOT NULL,
  body VARCHAR(500),
  type ENUM('task','message','system','deadline') NOT NULL,
  link VARCHAR(255),
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50),
  details JSON,
  ip_address VARCHAR(45),
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
