-- 修改商品主档销售规格表的列名：'规格' → '规格名称'
-- 执行日期：2025-10-15
-- 说明：将数据库列名从 '规格' 修改为 '规格名称'

USE `sm_shangping`;

-- 修改列名
ALTER TABLE `商品主档销售规格` 
CHANGE COLUMN `规格` `规格名称` VARCHAR(255);

-- 验证修改
SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'sm_shangping' 
  AND TABLE_NAME = '商品主档销售规格'
  AND COLUMN_NAME = '规格名称';

