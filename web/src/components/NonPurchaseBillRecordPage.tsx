"use client";

import { formatDateTime } from '@/lib/dateUtils';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Space,
  Tag,
  Typography,
  Upload,
  message
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { useCallback, useEffect, useState } from 'react';
import { NonPurchaseBillRecord, aclApi, maxStoreSkuInventoryApi, nonPurchaseBillRecordApi } from '../lib/api';
import BatchAddModal, { FieldConfig } from './BatchAddModal';
import ColumnSettings from './ColumnSettings';
import ResponsiveTable from './ResponsiveTable';

const { Title } = Typography;
const { TextArea } = Input;

export default function NonPurchaseBillRecordPage() {
  const [records, setRecords] = useState<NonPurchaseBillRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState('');
  // 单独的搜索字段
  const [search账单流水, setSearch账单流水] = useState('');
  const [search账单类型, setSearch账单类型] = useState('');
  const [search所属仓店, setSearch所属仓店] = useState('');
  const [search财务审核状态, setSearch财务审核状态] = useState('');
  const [search记录修改人, setSearch记录修改人] = useState('');
  const [search财务记账凭证号, setSearch财务记账凭证号] = useState('');

  // 门店名称列表
  const [storeNames, setStoreNames] = useState<string[]>([]);

  // 账单类型选项
  const billTypeOptions = ['个人流水', '仓店流水', '总部流水', '其他流水', '拼多多运费'];

  // 正在编辑的字段（用于行内编辑）
  const [editingField, setEditingField] = useState<{ record: NonPurchaseBillRecord; field: '账单类型' | '所属仓店' } | null>(null);
  // 是否正在显示确认对话框（用于防止onBlur冲突）
  const [isShowingConfirm, setIsShowingConfirm] = useState(false);

  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NonPurchaseBillRecord | null>(null);
  const [form] = Form.useForm();
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // 批量新增模态框状态
  const [batchModalVisible, setBatchModalVisible] = useState(false);

  // 列设置相关状态
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSettingsOpen, setColumnSettingsOpen] = useState(false);

  // 选中的行
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 用户角色ID列表
  const [userRoleIds, setUserRoleIds] = useState<number[]>([]);

  // 加载用户角色
  useEffect(() => {
    const loadUserRoles = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (userId) {
          const roleIds = await aclApi.userAssignedRoleIds(Number(userId));
          setUserRoleIds(roleIds || []);
        }
      } catch (error) {
        console.error('加载用户角色失败:', error);
        setUserRoleIds([]);
      }
    };
    loadUserRoles();
  }, []);

  // 检查是否有审核权限（role_id为1,4,7）
  const hasReviewPermission = () => {
    return userRoleIds.some(roleId => [1, 4, 7].includes(roleId));
  };

  // 审核通过/取消审核
  const handleReview = async (record: NonPurchaseBillRecord) => {
    if (!hasReviewPermission()) {
      message.error('您没有审核权限');
      return;
    }

    try {
      const newStatus = record.财务审核状态 === '审核通过' ? '0' : '审核通过';
      await nonPurchaseBillRecordApi.update(record.账单流水, {
        财务审核状态: newStatus,
      });
      message.success(newStatus === '审核通过' ? '审核通过成功' : '取消审核成功');
      refreshRecords();
    } catch (error: any) {
      message.error(error.message || '操作失败');
      console.error(error);
    }
  };

  // 加载记录列表
  const loadRecords = async (
    page: number = currentPage,
    search?: string,
    账单流水?: string,
    账单类型?: string,
    所属仓店?: string,
    财务审核状态?: string,
    记录修改人?: string,
    财务记账凭证号?: string,
    size?: number,
  ) => {
    try {
      setLoading(true);
      const currentSize = size ?? pageSize;
      // 如果有财务记账凭证号搜索，添加到search参数中
      let finalSearch = search;
      if (财务记账凭证号 && 财务记账凭证号.trim()) {
        finalSearch = finalSearch
          ? `${finalSearch} 财务记账凭证号:${财务记账凭证号.trim()}`
          : `财务记账凭证号:${财务记账凭证号.trim()}`;
      }
      const result = await nonPurchaseBillRecordApi.getAll({
        page,
        limit: currentSize,
        search: finalSearch,
        账单流水,
        账单类型,
        所属仓店,
        财务审核状态,
        记录修改人,
      });
      setRecords(result.data);
      setTotal(result.total);
    } catch (error: any) {
      message.error(error.message || '加载记录列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载
  useEffect(() => {
    loadRecords();
    // 加载门店名称列表
    maxStoreSkuInventoryApi.getStoreNames().then(names => {
      setStoreNames(names || []);
    }).catch(error => {
      console.error('加载门店名称列表失败:', error);
    });
  }, []);

  // 从 localStorage 加载列显示偏好和顺序
  useEffect(() => {
    const savedHiddenColumns = localStorage.getItem('non_purchase_bill_record_hidden_columns');
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        setHiddenColumns(new Set(parsed));
      } catch (error) {
        console.error('加载列显示偏好失败:', error);
      }
    }

    const savedColumnOrder = localStorage.getItem('non_purchase_bill_record_column_order');
    if (savedColumnOrder) {
      try {
        const parsed = JSON.parse(savedColumnOrder);
        setColumnOrder(parsed);
      } catch (error) {
        console.error('加载列顺序失败:', error);
      }
    }
  }, []);

  // 保存列显示偏好到 localStorage
  const saveHiddenColumns = (hidden: Set<string>) => {
    localStorage.setItem('non_purchase_bill_record_hidden_columns', JSON.stringify(Array.from(hidden)));
  };

  // 保存列顺序到 localStorage
  const saveColumnOrder = (order: string[]) => {
    localStorage.setItem('non_purchase_bill_record_column_order', JSON.stringify(order));
  };

  // 切换列显示/隐藏
  const handleToggleColumnVisibility = (columnKey: string) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(columnKey)) {
      newHidden.delete(columnKey);
    } else {
      newHidden.add(columnKey);
    }
    setHiddenColumns(newHidden);
    saveHiddenColumns(newHidden);
  };

  // 列顺序变更
  const handleColumnOrderChange = (newOrder: string[]) => {
    setColumnOrder(newOrder);
    saveColumnOrder(newOrder);
  };

  // 执行搜索（使用所有搜索条件）
  const handleSearchAll = () => {
    setCurrentPage(1);
    loadRecords(
      1,
      searchText || undefined,
      search账单流水 || undefined,
      search账单类型 || undefined,
      search所属仓店 || undefined,
      search财务审核状态 || undefined,
      search记录修改人 || undefined,
      search财务记账凭证号 || undefined,
    );
  };

  // 使用当前搜索条件刷新数据
  const refreshRecords = () => {
    loadRecords(
      currentPage,
      searchText || undefined,
      search账单流水 || undefined,
      search账单类型 || undefined,
      search所属仓店 || undefined,
      search财务审核状态 || undefined,
      search记录修改人 || undefined,
      search财务记账凭证号 || undefined,
    );
  };

  // 将文件转换为base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // 移除 data:image/xxx;base64, 前缀
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 图片上传前验证
  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return false;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('图片大小不能超过10MB！');
      return false;
    }
    return false; // 阻止自动上传，手动处理
  };

  // 图片变化处理
  const handleImageChange = (info: any) => {
    setImageFileList(info.fileList);
  };

  // 打开新增模态框
  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setImageFileList([]);
    setModalVisible(true);
  };

  // 打开编辑模态框
  const handleEdit = async (record: NonPurchaseBillRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      账单流水: record.账单流水,
      记账金额: record.记账金额,
      账单类型: record.账单类型,
      所属仓店: record.所属仓店,
      账单流水备注: record.账单流水备注,
      财务记账凭证号: record.财务记账凭证号,
      // 财务审核状态不允许编辑，不设置到表单中
      财务审核人: record.财务审核人,
    });

    // 如果有图片，异步加载图片
    if (record.图片 && record.账单流水) {
      try {
        const fullRecord = await nonPurchaseBillRecordApi.get(record.账单流水);
        if (fullRecord && fullRecord.图片) {
          // 如果已经是URL，直接使用；否则可能是base64（向后兼容）
          const imageUrl = fullRecord.图片.startsWith('http')
            ? fullRecord.图片
            : `data:image/jpeg;base64,${fullRecord.图片}`;
          setImageFileList([{
            uid: '-1',
            name: 'image.jpg',
            status: 'done',
            url: imageUrl,
          }]);
          // 在表单中设置图片字段（用于判断是否清空）
          form.setFieldValue('image', fullRecord.图片);
        } else {
          setImageFileList([]);
          form.setFieldValue('image', undefined);
        }
      } catch (error) {
        console.error('加载图片失败:', error);
        setImageFileList([]);
        form.setFieldValue('image', undefined);
      }
    } else {
      setImageFileList([]);
      form.setFieldValue('image', undefined);
    }
    setModalVisible(true);
  };

  // 查看图片
  const handleViewImage = async (record: NonPurchaseBillRecord) => {
    if (record.账单流水) {
      try {
        const fullRecord = await nonPurchaseBillRecordApi.get(record.账单流水);
        if (fullRecord && fullRecord.图片) {
          // 如果已经是URL，直接使用；否则可能是base64（向后兼容）
          const imageUrl = fullRecord.图片.startsWith('http')
            ? fullRecord.图片
            : `data:image/jpeg;base64,${fullRecord.图片}`;
          setPreviewImage(imageUrl);
          setPreviewVisible(true);
        } else {
          message.info('该记录没有图片');
        }
      } catch (error) {
        message.error('获取图片失败');
      }
    }
  };

  // 保存记录
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 处理图片
      let imageBase64: string | undefined;
      if (imageFileList.length > 0 && imageFileList[0].originFileObj) {
        // 新上传的图片
        imageBase64 = await fileToBase64(imageFileList[0].originFileObj);
      } else if (imageFileList.length > 0 && imageFileList[0].url) {
        // 编辑时，如果图片没有变化，使用原有的值
        const url = imageFileList[0].url;
        if (url.startsWith('data:image')) {
          // base64格式，提取base64部分
          imageBase64 = url.split(',')[1];
        } else if (url.startsWith('http')) {
          // OSS URL，直接使用URL
          imageBase64 = url;
        }
      } else {
        // 图片被清空或没有图片
        // 检查表单中的image字段，如果存在且不是空字符串，说明原来有图片但被清空了
        const formImageValue = form.getFieldValue('image');
        if (formImageValue === '') {
          // 明确设置为空字符串，表示要清空数据库中的图片
          imageBase64 = '';
        } else if (editingRecord && editingRecord.图片 && imageFileList.length === 0) {
          // 编辑时，原来有图片但现在清空了，使用空字符串来清空数据库中的值
          imageBase64 = '';
        } else {
          // 原来就没有图片，不设置image字段
          imageBase64 = undefined;
        }
      }

      const recordData: NonPurchaseBillRecord = {
        账单流水: values.账单流水,
        记账金额: values.记账金额 || undefined,
        账单类型: values.账单类型 || undefined,
        所属仓店: values.所属仓店 || undefined,
        账单流水备注: values.账单流水备注 || undefined,
        图片: imageBase64,
        财务记账凭证号: values.财务记账凭证号 || undefined,
        // 财务审核状态在新增时默认为"0"，编辑时不允许修改
        财务审核状态: editingRecord ? undefined : '0',
        财务审核人: values.财务审核人 || undefined,
      };

      if (editingRecord && editingRecord.账单流水) {
        // 更新时，不传递财务审核状态（保持原值）
        delete recordData.财务审核状态;
        await nonPurchaseBillRecordApi.update(editingRecord.账单流水, recordData);
        message.success('更新成功');
      } else {
        // 新增
        await nonPurchaseBillRecordApi.create(recordData);
        message.success('创建成功');
      }

      setModalVisible(false);
      setImageFileList([]);
      refreshRecords();
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      // 提取后端返回的错误消息
      let errorMessage = '未知错误';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      message.error((editingRecord ? '更新' : '创建') + '失败: ' + errorMessage);
    }
  };

  // 删除记录
  const handleDelete = async (账单流水: string) => {
    try {
      await nonPurchaseBillRecordApi.delete(账单流水);
      message.success('删除成功');
      refreshRecords();
    } catch (error: any) {
      message.error(error.message || '删除失败');
      console.error(error);
    }
  };

  // 行内编辑字段（账单类型或所属仓店）
  const handleInlineEdit = (record: NonPurchaseBillRecord, field: '账单类型' | '所属仓店') => {
    setEditingField({ record, field });
  };

  // 取消行内编辑
  const handleCancelInlineEdit = () => {
    // 如果正在显示确认对话框，不关闭编辑状态
    if (isShowingConfirm) {
      return;
    }
    setEditingField(null);
  };

  // 确认行内编辑
  const handleConfirmInlineEdit = async (newValue: string) => {
    if (!editingField) return;

    const { record, field } = editingField;
    const oldValue = record[field] || '';

    if (oldValue === newValue) {
      // 值没有变化，直接关闭编辑状态
      setEditingField(null);
      setIsShowingConfirm(false);
      return;
    }

    // 保存当前编辑状态，用于在确认对话框中使用
    const currentEditingField = editingField;
    const currentField = field;
    const currentRecord = record;

    // 设置标志，防止onBlur关闭编辑状态
    setIsShowingConfirm(true);

    // 先关闭编辑状态，避免与确认对话框冲突
    setEditingField(null);

    try {
      Modal.confirm({
        title: '确认修改',
        content: `确定要将${currentField === '账单类型' ? '账单类型' : '所属仓店'}从"${oldValue || '(空)'}"修改为"${newValue || '(空)'}"吗？`,
        okText: '确定',
        cancelText: '取消',
        onOk: async () => {
          try {
            const updateData: any = {};
            // 如果 newValue 是空字符串或 null，传递 undefined
            updateData[currentField] = (newValue && newValue.trim() !== '') ? newValue : undefined;

            console.log('准备保存数据:', {
              账单流水: currentRecord.账单流水,
              字段: currentField,
              新值: updateData[currentField],
              旧值: oldValue
            });

            await nonPurchaseBillRecordApi.update(currentRecord.账单流水, updateData);
            message.success('修改成功');
            refreshRecords();
          } catch (error: any) {
            const errorMessage = error?.response?.data?.message || error?.message || '修改失败';
            message.error(errorMessage);
            console.error('保存失败:', {
              error,
              response: error?.response,
              data: error?.response?.data,
              账单流水: currentRecord.账单流水,
              字段: currentField,
              新值: newValue
            });
            // 如果保存失败，重新打开编辑状态
            setEditingField(currentEditingField);
          } finally {
            setIsShowingConfirm(false);
          }
        },
        onCancel: () => {
          // 取消时重置标志
          setIsShowingConfirm(false);
        },
      });
    } catch (error) {
      // 如果显示确认对话框失败，重置状态
      setIsShowingConfirm(false);
      console.error('显示确认对话框失败:', error);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }

    try {
      const 账单流水列表 = selectedRowKeys.map((key: React.Key) => String(key));
      const result = await nonPurchaseBillRecordApi.batchDelete(账单流水列表);
      message.success(`成功删除 ${result.success} 条记录${result.failed > 0 ? `，失败 ${result.failed} 条` : ''}`);
      setSelectedRowKeys([]);
      refreshRecords();
    } catch (error: any) {
      message.error(error.message || '批量删除失败');
      console.error(error);
    }
  };

  const handleBatchAdd = () => {
    setBatchModalVisible(true);
  };

  // 批量新增字段配置
  const batchAddFields: FieldConfig<NonPurchaseBillRecord>[] = [
    {
      key: '账单流水' as keyof NonPurchaseBillRecord,
      label: '账单流水',
      excelHeaderName: '账单流水',
      required: true,
      index: 0,
    },
    {
      key: '记账金额' as keyof NonPurchaseBillRecord,
      label: '记账金额',
      excelHeaderName: '记账金额',
      required: false,
      index: 1,
      transform: (value: string) => value ? parseFloat(value) : undefined,
    },
    {
      key: '账单类型' as keyof NonPurchaseBillRecord,
      label: '账单类型',
      excelHeaderName: '账单类型',
      required: false,
      index: 2,
    },
    {
      key: '所属仓店' as keyof NonPurchaseBillRecord,
      label: '所属仓店',
      excelHeaderName: '所属仓店',
      required: false,
      index: 3,
    },
    {
      key: '账单流水备注' as keyof NonPurchaseBillRecord,
      label: '账单流水备注',
      excelHeaderName: '账单流水备注',
      required: false,
      index: 4,
    },
    {
      key: '财务记账凭证号' as keyof NonPurchaseBillRecord,
      label: '财务记账凭证号',
      excelHeaderName: '财务记账凭证号',
      required: false,
      index: 5,
    },
    {
      key: '财务审核人' as keyof NonPurchaseBillRecord,
      label: '财务审核人',
      excelHeaderName: '财务审核人',
      required: false,
      index: 6,
    },
  ];

  // 创建数据项
  const createBatchItem = useCallback((parts: string[]): Partial<NonPurchaseBillRecord> => {
    return {
      账单流水: parts[0] || '',
      记账金额: parts[1] && parts[1].trim() !== '' ? parseFloat(parts[1]) : undefined,
      账单类型: parts[2] && parts[2].trim() !== '' ? parts[2].trim() : undefined,
      所属仓店: parts[3] && parts[3].trim() !== '' ? parts[3].trim() : undefined,
      账单流水备注: parts[4] && parts[4].trim() !== '' ? parts[4].trim() : undefined,
      财务记账凭证号: parts[5] && parts[5].trim() !== '' ? parts[5].trim() : undefined,
      财务审核状态: undefined, // 财务审核状态不允许编辑，批量新增时默认为"0"（后端处理）
      财务审核人: parts[6] && parts[6].trim() !== '' ? parts[6].trim() : undefined,
    };
  }, []);

  // 批量保存
  const handleBatchSave = useCallback(async (validItems: NonPurchaseBillRecord[]) => {
    try {
      const result = await nonPurchaseBillRecordApi.batchCreate(validItems);
      if (result.errors && result.errors.length > 0) {
        message.warning(`部分数据创建失败: ${result.errors.join('; ')}`);
      }
      message.success('非采购账单流水记录-批量新增数据已完成');
      refreshRecords();
    } catch (e: any) {
      let errorMessage = '未知错误';
      if (e?.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e?.message) {
        errorMessage = e.message;
      }
      message.error('批量创建失败: ' + errorMessage);
    }
  }, []);

  // 格式化金额
  const formatAmount = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '-';
    return amount.toFixed(2);
  };

  // 表格列定义
  const allColumns = [
    {
      title: '账单流水',
      dataIndex: '账单流水',
      key: '账单流水',
      width: 180,
      fixed: 'left' as const,
    },
    {
      title: '记账金额',
      dataIndex: '记账金额',
      key: '记账金额',
      width: 120,
      align: 'right' as const,
      render: (text: number) => formatAmount(text),
    },
    {
      title: '账单类型',
      dataIndex: '账单类型',
      key: '账单类型',
      width: 150,
      render: (text: string, record: NonPurchaseBillRecord) => {
        if (editingField && editingField.record.账单流水 === record.账单流水 && editingField.field === '账单类型') {
          return (
            <Select
              style={{ width: '100%' }}
              value={text || undefined}
              onChange={(value) => {
                // 使用 setTimeout 确保在 onChange 完成后再处理，避免与 onBlur 冲突
                setTimeout(() => {
                  handleConfirmInlineEdit(value);
                }, 0);
              }}
              onBlur={(e) => {
                // 延迟处理onBlur，给onChange时间先执行
                setTimeout(() => {
                  if (!isShowingConfirm) {
                    handleCancelInlineEdit();
                  }
                }, 200);
              }}
              autoFocus
              open
              options={billTypeOptions.map(opt => ({ label: opt, value: opt }))}
            />
          );
        }
        return (
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => handleInlineEdit(record, '账单类型')}
            title="点击编辑"
          >
            {text || '-'}
          </span>
        );
      },
    },
    {
      title: '所属仓店',
      dataIndex: '所属仓店',
      key: '所属仓店',
      width: 200,
      render: (text: string, record: NonPurchaseBillRecord) => {
        if (editingField && editingField.record.账单流水 === record.账单流水 && editingField.field === '所属仓店') {
          return (
            <Select
              style={{ width: '100%' }}
              value={text || undefined}
              onChange={(value) => {
                // 使用 setTimeout 确保在 onChange 完成后再处理，避免与 onBlur 冲突
                setTimeout(() => {
                  handleConfirmInlineEdit(value);
                }, 0);
              }}
              onBlur={(e) => {
                // 延迟处理onBlur，给onChange时间先执行
                setTimeout(() => {
                  if (!isShowingConfirm) {
                    handleCancelInlineEdit();
                  }
                }, 200);
              }}
              autoFocus
              open
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={storeNames.map(name => ({ label: name, value: name }))}
            />
          );
        }
        return (
          <span
            style={{ cursor: 'pointer', color: '#1890ff' }}
            onClick={() => handleInlineEdit(record, '所属仓店')}
            title="点击编辑"
          >
            {text || '-'}
          </span>
        );
      },
    },
    {
      title: '账单流水备注',
      dataIndex: '账单流水备注',
      key: '账单流水备注',
      width: 200,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '图片',
      key: '图片',
      width: 120,
      render: (_: any, record: NonPurchaseBillRecord) => (
        record.图片 ? (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewImage(record)}
          >
            查看图片
          </Button>
        ) : '-'
      ),
    },
    {
      title: '财务记账凭证号',
      dataIndex: '财务记账凭证号',
      key: '财务记账凭证号',
      width: 180,
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: '财务审核状态',
      dataIndex: '财务审核状态',
      key: '财务审核状态',
      width: 140,
      render: (text: string, record: NonPurchaseBillRecord) => {
        if (text === '审核通过') {
          return <Tag color="blue">审核通过</Tag>;
        }
        return text || '-';
      },
    },
    {
      title: '审核操作',
      key: 'reviewAction',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: NonPurchaseBillRecord) => {
        if (!hasReviewPermission()) {
          return '-';
        }
        const isApproved = record.财务审核状态 === '审核通过';
        return (
          <Button
            type={isApproved ? 'default' : 'primary'}
            size="small"
            onClick={() => handleReview(record)}
          >
            {isApproved ? '取消审核' : '审核通过'}
          </Button>
        );
      },
    },
    {
      title: '记录修改人',
      dataIndex: '记录修改人',
      key: '记录修改人',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '财务审核人',
      dataIndex: '财务审核人',
      key: '财务审核人',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '记录增加时间',
      dataIndex: '记录增加时间',
      key: '记录增加时间',
      width: 180,
      render: (text: string) => formatDateTime(text),
    },
    {
      title: '最近修改时间',
      dataIndex: '最近修改时间',
      key: '最近修改时间',
      width: 180,
      render: (text: string) => formatDateTime(text),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (record: NonPurchaseBillRecord) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.账单流水)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 根据列设置过滤和排序列
  const getFilteredColumns = () => {
    const currentOrder = columnOrder.length > 0
      ? columnOrder
      : allColumns.map(col => col.key as string).filter(Boolean);

    // 确保操作列在顺序中
    if (!currentOrder.includes('action')) {
      currentOrder.push('action');
    }

    // 按照保存的顺序排列
    const orderedColumns = currentOrder
      .map(key => allColumns.find(col => col.key === key))
      .filter(Boolean) as typeof allColumns;

    // 过滤隐藏的列，但始终显示操作列
    return orderedColumns.filter(col => {
      const colKey = col.key as string;
      // 操作列始终显示
      if (colKey === 'action') {
        return true;
      }
      return !hiddenColumns.has(colKey);
    });
  };

  const columns = getFilteredColumns();

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedKeys: React.Key[]) => {
      setSelectedRowKeys(selectedKeys);
    },
  };

  return (
    <div style={{ padding: 0 }}>
      {/* 主要内容 */}
      <Card
        title={
          <Space>
            <Title level={4} style={{ margin: 0 }}>非采购单流水记录</Title>
          </Space>
        }
        extra={
          <Space>
            {/* 综合搜索框 */}
            <Input
              placeholder="综合搜索（所有字段）"
              allowClear
              style={{ width: 220 }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onPressEnter={handleSearchAll}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearchAll}
            >
              搜索
            </Button>
            <Popover
              content={
                <ColumnSettings
                  columns={allColumns}
                  hiddenColumns={hiddenColumns}
                  columnOrder={columnOrder}
                  onToggleVisibility={handleToggleColumnVisibility}
                  onMoveColumn={() => { }}
                  onColumnOrderChange={handleColumnOrderChange}
                />
              }
              title="列设置"
              trigger="click"
              open={columnSettingsOpen}
              onOpenChange={setColumnSettingsOpen}
              placement="bottomRight"
            >
              <Button icon={<SettingOutlined />}>列设置</Button>
            </Popover>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              新增
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={handleBatchAdd}
            >
              批量新增
            </Button>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 条记录吗？`}
                onConfirm={handleBatchDelete}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                >
                  批量删除 ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setSearchText('');
                setSearch账单流水('');
                setSearch账单类型('');
                setSearch所属仓店('');
                setSearch财务审核状态('');
                setSearch记录修改人('');
                setSearch财务记账凭证号('');
                setCurrentPage(1);
                // 重置时传入空的搜索参数，确保立即查询默认数据
                loadRecords(1, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
              }}
            >
              重置
            </Button>
          </Space>
        }
      >
        {/* 搜索区域 */}
        <div style={{ marginBottom: 16, padding: '16px', backgroundColor: '#fafafa', borderRadius: 4 }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>单独搜索</div>
            <Space wrap>
              <Input
                placeholder="账单流水"
                allowClear
                style={{ width: 180 }}
                value={search账单流水}
                onChange={(e) => setSearch账单流水(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="账单类型"
                allowClear
                style={{ width: 180 }}
                value={search账单类型}
                onChange={(e) => setSearch账单类型(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="所属仓店"
                allowClear
                style={{ width: 180 }}
                value={search所属仓店}
                onChange={(e) => setSearch所属仓店(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Select
                placeholder="财务审核状态"
                allowClear
                style={{ width: 180 }}
                value={search财务审核状态 || undefined}
                onChange={(value) => {
                  setSearch财务审核状态(value || '');
                  // 选择后自动触发查询
                  setCurrentPage(1);
                  loadRecords(
                    1,
                    searchText || undefined,
                    search账单流水 || undefined,
                    search账单类型 || undefined,
                    search所属仓店 || undefined,
                    value || undefined,
                    search记录修改人 || undefined,
                    search财务记账凭证号 || undefined,
                  );
                }}
                options={[
                  { label: '审核通过', value: '审核通过' },
                  { label: '0', value: '0' },
                ]}
              />
              <Input
                placeholder="记录修改人"
                allowClear
                style={{ width: 180 }}
                value={search记录修改人}
                onChange={(e) => setSearch记录修改人(e.target.value)}
                onPressEnter={handleSearchAll}
              />
              <Input
                placeholder="财务记账凭证号"
                allowClear
                style={{ width: 180 }}
                value={search财务记账凭证号}
                onChange={(e) => setSearch财务记账凭证号(e.target.value)}
                onPressEnter={handleSearchAll}
              />
            </Space>
          </Space>
        </div>
        <ResponsiveTable<NonPurchaseBillRecord>
          tableId="non-purchase-bill-record"
          columns={columns as any}
          dataSource={records}
          rowKey={(record) => record.账单流水}
          loading={loading}
          isMobile={false}
          scroll={{ x: 2000, y: 600 }}
          rowSelection={rowSelection}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              if (size && size !== pageSize) {
                setPageSize(size);
                // 切换分页大小时，立即加载数据，传入新的size
                loadRecords(
                  page,
                  searchText || undefined,
                  search账单流水 || undefined,
                  search账单类型 || undefined,
                  search所属仓店 || undefined,
                  search财务审核状态 || undefined,
                  search记录修改人 || undefined,
                  search财务记账凭证号 || undefined,
                  size,
                );
              } else {
                loadRecords(
                  page,
                  searchText || undefined,
                  search账单流水 || undefined,
                  search账单类型 || undefined,
                  search所属仓店 || undefined,
                  search财务审核状态 || undefined,
                  search记录修改人 || undefined,
                  search财务记账凭证号 || undefined,
                );
              }
            },
            onShowSizeChange: (current, size) => {
              setCurrentPage(1);
              setPageSize(size);
              // 切换分页大小时，立即加载数据，传入新的size
              loadRecords(
                1,
                searchText || undefined,
                search账单流水 || undefined,
                search账单类型 || undefined,
                search所属仓店 || undefined,
                search财务审核状态 || undefined,
                search记录修改人 || undefined,
                search财务记账凭证号 || undefined,
                size,
              );
            },
          }}
        />
      </Card>

      {/* 新增/编辑模态框 */}
      <Modal
        title={editingRecord ? '编辑记录' : '新增记录'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          setEditingRecord(null);
          form.resetFields();
          setImageFileList([]);
        }}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="账单流水"
            name="账单流水"
            rules={[
              { required: true, message: '请输入账单流水' },
              { whitespace: true, message: '账单流水不能为空' }
            ]}
          >
            <Input placeholder="请输入账单流水" disabled={!!editingRecord} />
          </Form.Item>

          <Form.Item
            label="记账金额"
            name="记账金额"
          >
            <InputNumber
              placeholder="请输入记账金额"
              style={{ width: '100%' }}
              precision={2}
            />
          </Form.Item>

          <Form.Item
            label="账单类型"
            name="账单类型"
          >
            <Select
              placeholder="请选择账单类型"
              allowClear
              options={billTypeOptions.map(opt => ({ label: opt, value: opt }))}
            />
          </Form.Item>

          <Form.Item
            label="所属仓店"
            name="所属仓店"
          >
            <Select
              placeholder="请选择所属仓店"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={storeNames.map(name => ({ label: name, value: name }))}
            />
          </Form.Item>

          <Form.Item
            label="账单流水备注"
            name="账单流水备注"
          >
            <TextArea
              rows={4}
              placeholder="请输入账单流水备注"
              maxLength={245}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="图片"
            help="支持上传图片，大小不超过10MB"
            name="image"
            style={{ display: 'none' }}
          >
            <Input type="hidden" />
          </Form.Item>
          <Form.Item
            label=" "
            colon={false}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Upload
                listType="picture-card"
                fileList={imageFileList}
                beforeUpload={beforeUpload}
                onChange={handleImageChange}
                onRemove={() => {
                  setImageFileList([]);
                  form.setFieldValue('image', '');
                  return true;
                }}
                maxCount={1}
              >
                {imageFileList.length < 1 && (
                  <div>
                    <PlusOutlined />
                    <div style={{ marginTop: 8 }}>上传图片</div>
                  </div>
                )}
              </Upload>
              {imageFileList.length > 0 && (
                <Button
                  danger
                  size="small"
                  onClick={() => {
                    setImageFileList([]);
                    // 设置为空字符串，表示要清空数据库中的图片
                    form.setFieldValue('image', '');
                  }}
                >
                  清空图片
                </Button>
              )}
            </Space>
          </Form.Item>

          <Form.Item
            label="财务记账凭证号"
            name="财务记账凭证号"
          >
            <Input placeholder="请输入财务记账凭证号" />
          </Form.Item>

          {/* 财务审核状态不允许编辑，新增时默认为"0" */}

          <Form.Item
            label="财务审核人"
            name="财务审核人"
          >
            <Input placeholder="请输入财务审核人" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量新增模态框 */}
      <BatchAddModal<NonPurchaseBillRecord>
        open={batchModalVisible}
        title="批量新增记录"
        hint="您可以从 Excel 中复制数据（包含账单流水、记账金额、账单类型、所属仓店、账单流水备注、财务记账凭证号、财务审核人列），然后粘贴到下方输入框中（Ctrl+V 或右键粘贴），或直接导入Excel文件。注意：财务审核状态列会被忽略，财务审核状态默认为'0'。"
        fields={batchAddFields}
        formatHint="格式：账单流水	记账金额	账单类型	所属仓店	账单流水备注	财务记账凭证号	财务审核人"
        example="BL001	1000.00	类型A	仓店1	备注	凭证001	审核人"
        onCancel={() => setBatchModalVisible(false)}
        onSave={handleBatchSave}
        createItem={createBatchItem}
      />

      {/* 图片预览 */}
      <Modal
        open={previewVisible}
        footer={null}
        onCancel={() => {
          setPreviewVisible(false);
          setPreviewImage(null);
        }}
        width={800}
        centered
      >
        {previewImage && (
          <Image
            src={previewImage}
            alt="预览"
            style={{ width: '100%' }}
          />
        )}
      </Modal>
    </div>
  );
}

