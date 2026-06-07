-- Seed scoring rule types

INSERT INTO scoring_rule_types (id, code, name_tr, description_tr, category, sort_order) VALUES
  (1, 'win', 'Galibiyet', 'Maç galibiyeti puanı', 'match', 1),
  (2, 'draw', 'Beraberlik', 'Maç beraberliği puanı', 'match', 2),
  (3, 'loss', 'Mağlubiyet', 'Maç mağlubiyeti puanı', 'match', 3),
  (4, 'goals_scored', 'Attığı Gol', 'Attığı gol başına puan', 'match', 4),
  (5, 'goals_conceded', 'Yediği Gol', 'Yediği gol başına puan', 'match', 5),
  (6, 'group_winner', 'Grup Liderliği', 'Grubu birinci bitirme puanı', 'group', 6),
  (7, 'group_runner_up', 'Grup İkinciliği', 'Grubu ikinci bitirme puanı', 'group', 7),
  (8, 'group_third', 'Grup Üçüncülüğü', 'Grubu üçüncü bitirme puanı', 'group', 8),
  (9, 'round_advance', 'Tur Atlama', 'Atladığı tur başına puan', 'knockout', 9),
  (10, 'silver_medal', 'Gümüş Madalya', 'Final kaybedenine verilen puan', 'medal', 10),
  (11, 'gold_medal', 'Altın Madalya', 'Şampiyona verilen puan', 'medal', 11);
