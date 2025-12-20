-- 1688退款售后表结构修改
-- 1. 将"发货截图"字段改名为"跟进情况/图片"
-- 2. 删除"出库单号（回库）"字段
-- 3. 删除"退款详情"字段
-- 4. 添加"跟进时间"字段（DATETIME类型，用于记录最后编辑时间）

USE `sm_chaigou`;

-- 步骤1: 将"发货截图"字段改名为"跟进情况/图片"
ALTER TABLE `1688退款售后` 
CHANGE COLUMN `发货截图` `跟进情况/图片` TEXT NULL COMMENT '跟进情况图片';

-- 步骤2: 删除"出库单号（回库）"字段
ALTER TABLE `1688退款售后` 
DROP COLUMN `出库单号（回库）`;

-- 步骤3: 删除"退款详情"字段
ALTER TABLE `1688退款售后` 
DROP COLUMN `退款详情`;

-- 步骤4: 添加"跟进时间"字段（如果不存在）
-- 检查字段是否存在，如果不存在则添加
SET @dbname = DATABASE();
SET @tablename = '1688退款售后';
SET @columnname = '跟进时间';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (TABLE_SCHEMA = @dbname)
      AND (TABLE_NAME = @tablename)
      AND (COLUMN_NAME = @columnname)
  ) > 0,
  'SELECT 1', -- 字段已存在，不执行任何操作
  CONCAT('ALTER TABLE `', @tablename, '` ADD COLUMN `', @columnname, '` DATETIME NULL COMMENT ''最后编辑时间''')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 注意：如果字段已存在，上面的语句不会报错，只是不执行任何操作
-- 如果需要强制添加（即使字段已存在），可以使用下面的语句（但会报错如果字段已存在）：
-- ALTER TABLE `1688退款售后` ADD COLUMN `跟进时间` DATETIME NULL COMMENT '最后编辑时间';

-- 步骤5: 将"物流单号"字段改名为"牵牛花物流单号"
ALTER TABLE `1688退款售后` 
CHANGE COLUMN `物流单号` `牵牛花物流单号` VARCHAR(255) NULL COMMENT '牵牛花物流单号';

