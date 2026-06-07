-- Seed teams with tiers and 2026 World Cup groups

INSERT INTO teams (name_tr, tier_id, group_code, fifa_code) VALUES
  -- Tier 1
  ('İspanya', 1, 'H', 'ESP'),
  ('Fransa', 1, 'I', 'FRA'),
  ('Arjantin', 1, 'J', 'ARG'),
  ('İngiltere', 1, 'L', 'ENG'),
  ('Brezilya', 1, 'C', 'BRA'),
  ('Portekiz', 1, 'K', 'POR'),
  ('Hollanda', 1, 'F', 'NED'),
  ('Almanya', 1, 'E', 'GER'),
  ('Belçika', 1, 'G', 'BEL'),
  -- Tier 2
  ('Hırvatistan', 2, 'L', 'CRO'),
  ('Kolombiya', 2, 'K', 'COL'),
  ('Fas', 2, 'C', 'MAR'),
  ('Senegal', 2, 'I', 'SEN'),
  ('Japonya', 2, 'F', 'JPN'),
  ('Uruguay', 2, 'H', 'URU'),
  ('İsviçre', 2, 'B', 'SUI'),
  ('Meksika', 2, 'A', 'MEX'),
  ('Türkiye', 2, 'D', 'TUR'),
  ('Norveç', 2, 'I', 'NOR'),
  -- Tier 3
  ('Ekvador', 3, 'E', 'ECU'),
  ('Avusturya', 3, 'J', 'AUT'),
  ('ABD', 3, 'D', 'USA'),
  ('İran', 3, 'G', 'IRN'),
  ('Avustralya', 3, 'D', 'AUS'),
  ('Güney Kore', 3, 'A', 'KOR'),
  ('Kanada', 3, 'B', 'CAN'),
  ('Cezayir', 3, 'J', 'ALG'),
  ('İsveç', 3, 'F', 'SWE'),
  -- Tier 4
  ('Paraguay', 4, 'D', 'PAR'),
  ('Mısır', 4, 'G', 'EGY'),
  ('Panama', 4, 'L', 'PAN'),
  ('İskoçya', 4, 'C', 'SCO'),
  ('Fildişi Sahili', 4, 'E', 'CIV'),
  ('Çekya', 4, 'A', 'CZE'),
  ('Özbekistan', 4, 'K', 'UZB'),
  ('Gana', 4, 'L', 'GHA'),
  ('Bosna-Hersek', 4, 'B', 'BIH'),
  -- Tier 5
  ('Tunus', 5, 'F', 'TUN'),
  ('Irak', 5, 'I', 'IRQ'),
  ('Ürdün', 5, 'J', 'JOR'),
  ('Suudi Arabistan', 5, 'H', 'KSA'),
  ('Güney Afrika', 5, 'A', 'RSA'),
  ('Katar', 5, 'B', 'QAT'),
  ('Yeşil Burun Adaları', 5, 'H', 'CPV'),
  ('Demokratik Kongo', 5, 'K', 'COD'),
  ('Yeni Zelanda', 5, 'G', 'NZL'),
  ('Haiti', 5, 'C', 'HAI'),
  ('Curaçao', 5, 'E', 'CUW');

-- Initialize group standings for all teams
INSERT INTO group_standings (team_id, group_code)
SELECT id, group_code FROM teams;
