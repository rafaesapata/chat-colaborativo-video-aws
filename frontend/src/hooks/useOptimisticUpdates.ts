/**
 * Optimistic Updates com Rollback
 * Atualiza UI imediatamente e reverte em caso de erro
 */

import { useState, useCallback } from 'react';

interface OptimisticItem {
  _pending?: boolean;
  _failed?: boolean;
}

export function useOptimisticUpdates<T extends OptimisticItem & { id: string }>(
  initialValue: T[] = []
) {
  const [items, setItems] = useState<T[]>(initialValue);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());

  const addOptimistic = useCallback(
    (item: T, serverOperation: () => Promise<T>) => {
      const itemId = item.id;

      // 1. Adicionar imediatamente (optimistic)
      setItems((prev) => [...prev, { ...item, _pending: true }]);
      setPendingIds((prev) => new Set(prev).add(itemId));

      // 2. Executar operação no servidor
      serverOperation()
        .then((serverItem) => {
          // Sucesso: substituir item optimistic pelo real
          setItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...serverItem, _pending: false } : i))
          );
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        })
        .catch((error) => {
          // Falha: marcar como falhou (pode tentar retry)
          console.error('[Optimistic] Rollback:', itemId, error);
          setItems((prev) =>
            prev.map((i) =>
              i.id === itemId ? { ...i, _pending: false, _failed: true } : i
            )
          );
          setFailedIds((prev) => new Set(prev).add(itemId));
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        });
    },
    []
  );

  const updateOptimistic = useCallback(
    (itemId: string, updates: Partial<T>, serverOperation: () => Promise<T>) => {
      // Guardar estado anterior para rollback
      let previousItem: T | undefined;

      // 1. Atualizar imediatamente
      setItems((prev) => {
        previousItem = prev.find((i) => i.id === itemId);
        return prev.map((i) =>
          i.id === itemId ? { ...i, ...updates, _pending: true } : i
        );
      });
      setPendingIds((prev) => new Set(prev).add(itemId));

      // 2. Executar operação no servidor
      serverOperation()
        .then((serverItem) => {
          setItems((prev) =>
            prev.map((i) => (i.id === itemId ? { ...serverItem, _pending: false } : i))
          );
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        })
        .catch((error) => {
          // Rollback para estado anterior
          console.error('[Optimistic] Rollback update:', itemId, error);
          if (previousItem) {
            setItems((prev) =>
              prev.map((i) =>
                i.id === itemId ? { ...previousItem!, _failed: true } : i
              )
            );
          }
          setFailedIds((prev) => new Set(prev).add(itemId));
          setPendingIds((prev) => {
            const next = new Set(prev);
            next.delete(itemId);
            return next;
          });
        });
    },
    []
  );

  const removeOptimistic = useCallback(
    (itemId: string, serverOperation?: () => Promise<void>) => {
      // Guardar item para possível rollback
      let removedItem: T | undefined;

      // 1. Remover imediatamente
      setItems((prev) => {
        removedItem = prev.find((i) => i.id === itemId);
        return prev.filter((i) => i.id !== itemId);
      });

      // 2. Se tem operação de servidor, executar
      if (serverOperation) {
        serverOperation().catch((error) => {
          // Rollback: restaurar item
          console.error('[Optimistic] Rollback remove:', itemId, error);
          if (removedItem) {
            setItems((prev) => [...prev, { ...removedItem!, _failed: true }]);
            setFailedIds((prev) => new Set(prev).add(itemId));
          }
        });
      }

      // Limpar dos sets
      setFailedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    },
    []
  );

  const retryFailed = useCallback(
    (itemId: string, serverOperation: () => Promise<T>) => {
      setFailedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });

      const item = items.find((i) => i.id === itemId);
      if (item) {
        // Remover item falho e adicionar novamente
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        addOptimistic({ ...item, _failed: false }, serverOperation);
      }
    },
    [items, addOptimistic]
  );

  const clearFailed = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setFailedIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
  }, []);

  const setItemsDirectly = useCallback((newItems: T[]) => {
    setItems(newItems);
    setPendingIds(new Set());
    setFailedIds(new Set());
  }, []);

  return {
    items,
    pendingIds,
    failedIds,
    addOptimistic,
    updateOptimistic,
    removeOptimistic,
    retryFailed,
    clearFailed,
    setItems: setItemsDirectly,
    isPending: (id: string) => pendingIds.has(id),
    hasFailed: (id: string) => failedIds.has(id),
    hasPendingItems: pendingIds.size > 0,
    hasFailedItems: failedIds.size > 0,
  };
}
