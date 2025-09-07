"use client";

import { mutate } from "swr";

/**
 * Hook for managing sidebar history updates
 * Provides functions to trigger sidebar refresh when chats are created or updated
 */
export function useSidebarHistory() {
  // Invalidate all history cache keys to trigger refresh
  const refreshSidebar = () => {
    console.log("🔄 Refreshing sidebar history...");
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/history"),
      undefined,
      { revalidate: true }
    );
  };

  // Optimistically add a new chat to the sidebar
  const addNewChatToSidebar = (newChat: {
    id: string;
    title: string;
    userId: string;
    visibility: "public" | "private";
    createdAt: Date;
  }) => {
    console.log("➕ Adding new chat to sidebar:", newChat.title);

    // Update all history cache pages to include the new chat at the top
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/history"),
      (currentPages: any) => {
        if (!Array.isArray(currentPages)) return currentPages;

        // Add the new chat to the first page
        const updatedPages = [...currentPages];
        if (updatedPages.length > 0 && updatedPages[0]?.chats) {
          updatedPages[0] = {
            ...updatedPages[0],
            chats: [newChat, ...updatedPages[0].chats],
          };
        } else {
          // If no pages exist, create the first page
          updatedPages.unshift({
            chats: [newChat],
            hasMore: false,
          });
        }

        return updatedPages;
      },
      { revalidate: false } // Don't revalidate immediately, we just updated optimistically
    );
  };

  // Update a chat title in the sidebar
  const updateChatTitleInSidebar = (chatId: string, newTitle: string) => {
    console.log("✏️ Updating chat title in sidebar:", chatId, newTitle);

    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/history"),
      (currentPages: any) => {
        if (!Array.isArray(currentPages)) return currentPages;

        return currentPages.map((page) => ({
          ...page,
          chats: Array.isArray(page?.chats)
            ? page.chats.map((chat: any) =>
                chat?.id === chatId ? { ...chat, title: newTitle } : chat
              )
            : page?.chats,
        }));
      },
      { revalidate: false } // Optimistic update, no need to revalidate
    );
  };

  return {
    refreshSidebar,
    addNewChatToSidebar,
    updateChatTitleInSidebar,
  };
}

// Global functions that can be called from anywhere
export const sidebarHistoryActions = {
  refresh: () => {
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/history"),
      undefined,
      { revalidate: true }
    );
  },

  addNewChat: (newChat: {
    id: string;
    title: string;
    userId: string;
    visibility: "public" | "private";
    createdAt: Date;
  }) => {
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/history"),
      (currentPages: any) => {
        if (!Array.isArray(currentPages)) return currentPages;

        const updatedPages = [...currentPages];
        if (updatedPages.length > 0 && updatedPages[0]?.chats) {
          updatedPages[0] = {
            ...updatedPages[0],
            chats: [newChat, ...updatedPages[0].chats],
          };
        } else {
          updatedPages.unshift({
            chats: [newChat],
            hasMore: false,
          });
        }

        return updatedPages;
      },
      { revalidate: false }
    );
  },

  updateChatTitle: (chatId: string, newTitle: string) => {
    mutate(
      (key) => typeof key === "string" && key.startsWith("/api/history"),
      (currentPages: any) => {
        if (!Array.isArray(currentPages)) return currentPages;

        return currentPages.map((page) => ({
          ...page,
          chats: Array.isArray(page?.chats)
            ? page.chats.map((chat: any) =>
                chat?.id === chatId ? { ...chat, title: newTitle } : chat
              )
            : page?.chats,
        }));
      },
      { revalidate: false }
    );
  },
};
