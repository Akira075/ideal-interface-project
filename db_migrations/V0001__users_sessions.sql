CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  nickname VARCHAR(64) UNIQUE NOT NULL,
  full_name VARCHAR(128) NOT NULL DEFAULT '',
  role VARCHAR(32) NOT NULL DEFAULT 'student',
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

INSERT INTO users (username, nickname, full_name, role, status, password_hash)
VALUES ('Astrovskii', 'Amir_Karver', 'Супер-Разработчик', 'dev', 'active', 'pbkdf2$89f6bf541d174299e77e6d522696333d$7b016808789983057e9c2516f1fe8bee0c0f7330ea1480c0f2768d059ece9d98')
ON CONFLICT (username) DO NOTHING;