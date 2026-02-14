import { hmso } from '../lib/supabase';

// Types
export interface GroupCategory {
  id: string;
  slug: string;
  label: string;
  color: string;
  icon: string | null;
  sort_order: number;
  briefing_priority: number;
  description: string | null;
  name_patterns: string[];
  created_at: string;
  updated_at: string;
}

// Service Functions

/**
 * Fetch all group categories ordered by sort_order
 */
export async function fetchCategories() {
  try {
    const { data, error } = await hmso
      .from('group_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[group-category-service] fetchCategories error:', error.message, error.details, error.hint);
    }

    return { data, error };
  } catch (error) {
    console.error('[group-category-service] fetchCategories exception:', error);
    return { data: null, error };
  }
}

/**
 * Create or update a group category
 */
export async function upsertCategory(category: Partial<GroupCategory> & { id?: string }) {
  try {
    const { data, error } = await hmso
      .from('group_categories')
      .upsert(category)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Reorder categories by updating sort_order based on array position
 */
export async function reorderCategories(orderedIds: string[]) {
  try {
    const updates = orderedIds.map((id, index) =>
      hmso
        .from('group_categories')
        .update({ sort_order: (index + 1) * 10 })
        .eq('id', id)
    );

    const results = await Promise.all(updates);
    
    // Check if any update failed
    const error = results.find(result => result.error)?.error;
    
    return { data: results, error: error || null };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Delete a category and reassign its groups to uncategorized
 */
export async function deleteCategory(id: string) {
  try {
    // First, get the uncategorized category id
    const { data: uncategorized, error: uncategorizedError } = await hmso
      .from('group_categories')
      .select('id')
      .eq('slug', 'uncategorized')
      .single();

    if (uncategorizedError || !uncategorized) {
      return { data: null, error: uncategorizedError || new Error('Uncategorized category not found') };
    }

    // Update all groups with this category to uncategorized
    const { error: updateError } = await hmso
      .from('groups')
      .update({ category_id: uncategorized.id })
      .eq('category_id', id);

    if (updateError) {
      return { data: null, error: updateError };
    }

    // Delete the category
    const { data, error } = await hmso
      .from('group_categories')
      .delete()
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Update a single group's category
 */
export async function updateGroupCategory(groupId: string, categoryId: string) {
  try {
    const { data, error } = await hmso
      .from('groups')
      .update({ category_id: categoryId })
      .eq('id', groupId)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Batch update multiple groups' category
 */
export async function bulkUpdateGroupCategory(groupIds: string[], categoryId: string) {
  try {
    const { data, error } = await hmso
      .from('groups')
      .update({ category_id: categoryId })
      .in('id', groupIds)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}
