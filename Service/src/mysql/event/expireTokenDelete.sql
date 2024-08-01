-- 만료된 토큰 데이터 삭제 이벤트
CREATE EVENT delete_expired_tokens
ON SCHEDULE
	EVERY 1 DAY
	STARTS TIMESTAMP(CONCAT(CURRENT_DATE, ' 00:00:00'))
DO
	DELETE FROM mealmory.verification WHERE exp_date < NOW(); 