import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export interface WidgetConfig {
  id: string;
  visible: boolean;
  position: number;
}

export interface DashboardLayout {
  widgets: WidgetConfig[];
  tab: string;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'alerts', visible: true, position: 0 },
  { id: 'pendingRequests', visible: true, position: 1 },
  { id: 'whosOut', visible: true, position: 2 },
  { id: 'onboarding', visible: true, position: 3 },
  { id: 'analytics', visible: true, position: 4 },
  { id: 'myPayslips', visible: true, position: 5 },
];

export function useDashboardConfig(tab: 'overview' | 'hr' | 'financial') {
  const [layout, setLayout] = useState<DashboardLayout>({
    widgets: DEFAULT_WIDGETS,
    tab
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLayout();
  }, [tab]);

  const fetchLayout = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/config');
      if (res.data?.widgets) {
        setLayout(res.data);
      }
    } catch {
      // Use defaults if no config saved
    } finally {
      setLoading(false);
    }
  };

  const saveLayout = useCallback(async (newLayout: DashboardLayout) => {
    try {
      await api.post('/dashboard/config', newLayout);
      setLayout(newLayout);
    } catch (error) {
      console.error('Failed to save dashboard layout:', error);
    }
  }, []);

  const toggleWidget = useCallback((widgetId: string) => {
    const newWidgets = layout.widgets.map(w =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    const newLayout = { ...layout, widgets: newWidgets };
    setLayout(newLayout);
    if (!isEditing) {
      saveLayout(newLayout);
    }
  }, [layout, isEditing, saveLayout]);

  const reorderWidgets = useCallback((fromIndex: number, toIndex: number) => {
    const widgets = [...layout.widgets];
    const [moved] = widgets.splice(fromIndex, 1);
    widgets.splice(toIndex, 0, moved);
    const reordered = widgets.map((w, i) => ({ ...w, position: i }));
    const newLayout = { ...layout, widgets: reordered };
    setLayout(newLayout);
    if (!isEditing) {
      saveLayout(newLayout);
    }
  }, [layout, isEditing, saveLayout]);

  const toggleEditMode = useCallback(() => {
    if (isEditing) {
      // Save when exiting edit mode
      saveLayout(layout);
    }
    setIsEditing(!isEditing);
  }, [isEditing, layout, saveLayout]);

  return {
    layout,
    isEditing,
    loading,
    toggleWidget,
    reorderWidgets,
    toggleEditMode,
    saveLayout
  };
}