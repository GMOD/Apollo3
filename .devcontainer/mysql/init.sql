CREATE TABLE `grails_user` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `version` bigint(20) NOT NULL,
  `first_name` varchar(255) NOT NULL,
  `inactive` bit(1) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `metadata` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_rdmcxcj6i53kfjmb9j811ta1m` (`username`)
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4;
CREATE TABLE `role` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `version` bigint(20) NOT NULL,
  `name` varchar(255) NOT NULL,
  `rank` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK_8sewwnpamngi6b1dwaa88askk` (`name`),
  UNIQUE KEY `UK_1uxpq87pyp6d4vp86es3ew5lf` (`rank`)
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4;
CREATE TABLE `grails_user_roles` (
  `role_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`user_id`, `role_id`),
  KEY `FK_4mxkyj2itw9wyvcn6d8d4mta2` (`role_id`),
  CONSTRAINT `FK_4mxkyj2itw9wyvcn6d8d4mta2` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`),
  CONSTRAINT `FK_jsuq1rc9mb07tg4kubnqn8yw6` FOREIGN KEY (`user_id`) REFERENCES `grails_user` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 1 DEFAULT CHARSET = utf8mb4;
INSERT INTO role (`version`, `name`, `rank`)
VALUES(1, 'USER', 10);
INSERT INTO role (`version`, `name`, `rank`)
VALUES(1, 'INSTRUCTOR', 50);
INSERT INTO role (`version`, `name`, `rank`)
VALUES(1, 'ADMIN', 100);
COMMIT;
