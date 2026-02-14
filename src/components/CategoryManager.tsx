import { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Trash2, Plus, Save, RefreshCw } from 'lucide-react';
import { useGroupCategories } from '../hooks/useGroupCategories';
import { 
  upsertCategory, 
  reorderCategories, 
  deleteCategory,
  type GroupCategory 
} from '../services/group-category-service';
import { hmso } from '../lib/supabase';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Color options for the picker
const COLOR_OPTIONS = [
  { name: 'emerald', label: 'Emerald', class: 'bg-emerald-500' },
  { name: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { name: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { name: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { name: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
  { name: 'pink', label: 'Pink', class: 'bg-pink-500' },
  { name: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { name: 'slate', label: 'Slate', class: 'bg-slate-500' },
  { name: 'gray', label: 'Gray', class: 'bg-gray-500' },
];

// Priority options
const PRIORITY_OPTIONS = [
  { value: 1, label: '1 - Highest' },
  { value: 2, label: '2 - Very High' },
  { value: 3, label: '3 - High' },
  { value: 4, label: '4 - Above Normal' },
  { value: 5, label: '5 - Normal' },
  { value: 6, label: '6 - Below Normal' },
  { value: 7, label: '7 - Low' },
  { value: 8, label: '8 - Very Low' },
  { value: 9, label: '9 - Lowest' },
];

interface EditingCategory extends Partial<GroupCategory> {
  id?: string;
  label: string;
  color: string;
  briefing_priority: number;
  name_patterns: string[];
}

export function CategoryManager({ isOpen, onClose }: CategoryManagerProps) {
  const { categories, loading, refetch } = useGroupCategories();
  const [localCategories, setLocalCategories] = useState<GroupCategory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<EditingCategory | null>(null);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoClassifying, setIsAutoClassifying] = useState(false);

  // Sync categories to local state
  useEffect(() => {
    if (categories) {
      setLocalCategories([...categories]);
    }
  }, [categories]);

  // Fetch group counts for each category
  useEffect(() => {
    if (!isOpen || !categories) return;

    const fetchGroupCounts = async () => {
      try {
        const counts: Record<string, number> = {};
        
        for (const category of categories) {
          const { count, error } = await hmso
            .from('groups')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id);

          if (!error && count !== null) {
            counts[category.id] = count;
          }
        }

        setGroupCounts(counts);
      } catch (error) {
        console.error('Error fetching group counts:', error);
      }
    };

    fetchGroupCounts();
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const handleEdit = (category: GroupCategory) => {
    setEditingId(category.id);
    setEditingData({
      ...category,
      name_patterns: [...category.name_patterns],
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingData(null);
    setIsAddingNew(false);
  };

  const handleSave = async () => {
    if (!editingData) return;

    setIsSaving(true);
    try {
      const dataToSave: Partial<GroupCategory> = {
        label: editingData.label,
        color: editingData.color,
        briefing_priority: editingData.briefing_priority,
        name_patterns: editingData.name_patterns,
      };

      if (editingData.id) {
        dataToSave.id = editingData.id;
      } else {
        // New category - generate slug from label
        dataToSave.slug = editingData.label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        dataToSave.sort_order = (localCategories.length + 1) * 10;
      }

      const { error } = await upsertCategory(dataToSave);

      if (error) {
        console.error('Error saving category:', error);
        alert('Failed to save category. Please try again.');
      } else {
        await refetch();
        handleCancelEdit();
      }
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNew = () => {
    setIsAddingNew(true);
    setEditingId('new');
    setEditingData({
      label: '',
      color: 'gray',
      briefing_priority: 5,
      name_patterns: [],
    });
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;

    const newOrder = [...localCategories];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setLocalCategories(newOrder);

    const orderedIds = newOrder.map(cat => cat.id);
    await reorderCategories(orderedIds);
    await refetch();
  };

  const handleMoveDown = async (index: number) => {
    if (index === localCategories.length - 1) return;

    const newOrder = [...localCategories];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setLocalCategories(newOrder);

    const orderedIds = newOrder.map(cat => cat.id);
    await reorderCategories(orderedIds);
    await refetch();
  };

  const handleDelete = async (category: GroupCategory) => {
    // Prevent deleting uncategorized
    if (category.slug === 'uncategorized') {
      alert('Cannot delete the Uncategorized category.');
      return;
    }

    const confirmed = window.confirm(
      `Delete "${category.label}"?\n\nAll groups in this category will be moved to Uncategorized.`
    );

    if (!confirmed) return;

    try {
      const { error } = await deleteCategory(category.id);

      if (error) {
        console.error('Error deleting category:', error);
        alert('Failed to delete category. Please try again.');
      } else {
        await refetch();
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category. Please try again.');
    }
  };

  const handleRerunAutoClassify = async () => {
    const confirmed = window.confirm(
      'Re-run auto-classification?\n\nThis will apply name patterns to all uncategorized groups.'
    );

    if (!confirmed) return;

    setIsAutoClassifying(true);
    try {
      // Get uncategorized category id
      const uncategorizedCategory = categories?.find(cat => cat.slug === 'uncategorized');
      if (!uncategorizedCategory) {
        alert('Uncategorized category not found.');
        return;
      }

      // Run the auto-classification logic
      for (const category of categories || []) {
        if (category.name_patterns.length === 0) continue;

        for (const pattern of category.name_patterns) {
          await hmso
            .from('groups')
            .update({ category_id: category.id })
            .eq('category_id', uncategorizedCategory.id)
            .like('name', pattern);
        }
      }

      alert('Auto-classification complete!');
      await refetch();
    } catch (error) {
      console.error('Error running auto-classification:', error);
      alert('Failed to run auto-classification. Please try again.');
    } finally {
      setIsAutoClassifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex">
        <div className="w-screen max-w-2xl">
          <div className="h-full flex flex-col bg-white shadow-xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Manage Categories
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-500 transition-colors"
                  aria-label="Close category manager"
                >
                  <X className="w-6 h-6" />
                  <span className="sr-only">Close</span>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {loading ? (
                <div className="text-center py-8 text-gray-500">
                  Loading categories...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleAddNew}
                      disabled={isAddingNew || editingId !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Category
                    </button>
                    <button
                      onClick={handleRerunAutoClassify}
                      disabled={isAutoClassifying || editingId !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 ${isAutoClassifying ? 'animate-spin' : ''}`} />
                      Re-run Auto-Classify
                    </button>
                  </div>

                  {/* New category form */}
                  {isAddingNew && editingData && (
                    <CategoryEditForm
                      data={editingData}
                      onChange={setEditingData}
                      onSave={handleSave}
                      onCancel={handleCancelEdit}
                      isSaving={isSaving}
                      isNew={true}
                    />
                  )}

                  {/* Category list */}
                  <div className="space-y-3">
                    {localCategories.map((category, index) => (
                      <div
                        key={category.id}
                        className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                      >
                        {editingId === category.id && editingData ? (
                          <CategoryEditForm
                            data={editingData}
                            onChange={setEditingData}
                            onSave={handleSave}
                            onCancel={handleCancelEdit}
                            isSaving={isSaving}
                            isNew={false}
                          />
                        ) : (
                          <CategoryViewMode
                            category={category}
                            groupCount={groupCounts[category.id] || 0}
                            onEdit={() => handleEdit(category)}
                            onDelete={() => handleDelete(category)}
                            onMoveUp={() => handleMoveUp(index)}
                            onMoveDown={() => handleMoveDown(index)}
                            canMoveUp={index > 0}
                            canMoveDown={index < localCategories.length - 1}
                            isUncategorized={category.slug === 'uncategorized'}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Category view mode component
interface CategoryViewModeProps {
  category: GroupCategory;
  groupCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isUncategorized: boolean;
}

function CategoryViewMode({
  category,
  groupCount,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isUncategorized,
}: CategoryViewModeProps) {
  const colorClass = COLOR_OPTIONS.find(c => c.name === category.color)?.class || 'bg-gray-500';

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-6 h-6 rounded-full ${colorClass}`} />
          <div>
            <h3 className="font-semibold text-gray-900">{category.label}</h3>
            <p className="text-sm text-gray-500">
              {groupCount} {groupCount === 1 ? 'group' : 'groups'} • Priority: {category.briefing_priority}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Reorder buttons */}
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-5 h-5" />
          </button>

          {/* Edit button */}
          <button
            onClick={onEdit}
            className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Edit
          </button>

          {/* Delete button */}
          {!isUncategorized && (
            <button
              onClick={onDelete}
              className="p-1 text-red-400 hover:text-red-600"
              title="Delete category"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Name patterns */}
      {category.name_patterns.length > 0 && (
        <div className="text-sm">
          <span className="text-gray-600 font-medium">Patterns: </span>
          <span className="text-gray-500">
            {category.name_patterns.join(', ')}
          </span>
        </div>
      )}

      {category.description && (
        <p className="text-sm text-gray-600">{category.description}</p>
      )}
    </div>
  );
}

// Category edit form component
interface CategoryEditFormProps {
  data: EditingCategory;
  onChange: (data: EditingCategory) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isNew: boolean;
}

function CategoryEditForm({
  data,
  onChange,
  onSave,
  onCancel,
  isSaving,
  isNew,
}: CategoryEditFormProps) {
  return (
    <div className="space-y-4">
      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Label
        </label>
        <input
          type="text"
          value={data.label}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Category name"
        />
      </div>

      {/* Color picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Color
        </label>
        <div className="flex flex-wrap gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color.name}
              onClick={() => onChange({ ...data, color: color.name })}
              className={`w-10 h-10 rounded-full ${color.class} ${
                data.color === color.name
                  ? 'ring-2 ring-offset-2 ring-blue-500'
                  : 'hover:ring-2 hover:ring-offset-2 hover:ring-gray-300'
              }`}
              title={color.label}
              aria-label={`Select ${color.label} color`}
            >
              <span className="sr-only">{color.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Briefing priority */}
      <div>
        <label htmlFor="briefing-priority" className="block text-sm font-medium text-gray-700 mb-1">
          Briefing Priority
        </label>
        <select
          id="briefing-priority"
          value={data.briefing_priority}
          onChange={(e) => onChange({ ...data, briefing_priority: parseInt(e.target.value) })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          1-3: Expanded in briefings • 4-6: Collapsed • 7-9: Hidden
        </p>
      </div>

      {/* Name patterns */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name Patterns (one per line)
        </label>
        <textarea
          value={data.name_patterns.join('\n')}
          onChange={(e) => onChange({ 
            ...data, 
            name_patterns: e.target.value.split('\n').filter(p => p.trim()) 
          })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
          rows={4}
          placeholder="%[HM]%&#10;Hokky%&#10;HM %"
        />
        <p className="mt-1 text-xs text-gray-500">
          SQL LIKE patterns for auto-classification (e.g., %[HM]%, Hokky%)
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onSave}
          disabled={isSaving || !data.label.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : isNew ? 'Create' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
