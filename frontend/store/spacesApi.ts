import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { ImageNode } from './imagesSlice';

export interface CanvasState {
  nodes: ImageNode[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface Space {
  id: string;
  name?: string;
  node_count: number;
}

export const spacesApi = createApi({
  reducerPath: 'spacesApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:8080/api' }),
  tagTypes: ['Space', 'Spaces'],
  endpoints: (build) => ({
    loadCanvasState: build.query<CanvasState, string>({
      query: (spaceId) => `/spaces/load/${spaceId}`,
      providesTags: (result, error, spaceId) => [{ type: 'Space', id: spaceId }],
      // Always refetch from file system to ensure deterministic behavior
      refetchOnMountOrArgChange: true,
    }),
    saveCanvasState: build.mutation<void, { spaceId: string; state: CanvasState }>({
      query: ({ spaceId, state }) => ({
        url: '/spaces/save',
        method: 'POST',
        body: { space_id: spaceId, state },
      }),
      invalidatesTags: (result, error, { spaceId }) => [
        { type: 'Space', id: spaceId },
        { type: 'Spaces', id: 'LIST' },
      ],
    }),
    listSpaces: build.query<Space[], void>({
      query: () => '/spaces',
      providesTags: [{ type: 'Spaces', id: 'LIST' }],
    }),
    deleteImage: build.mutation<void, { spaceId: string; imageId: string }>({
      query: ({ spaceId, imageId }) => ({
        url: '/spaces/delete-image',
        method: 'POST',
        body: { space_id: spaceId, image_id: imageId },
      }),
      invalidatesTags: (result, error, { spaceId }) => [
        { type: 'Space', id: spaceId },
        { type: 'Spaces', id: 'LIST' },
      ],
    }),
    deleteSpace: build.mutation<void, string>({
      query: (spaceId) => ({
        url: '/spaces/delete',
        method: 'POST',
        body: { space_id: spaceId },
      }),
      invalidatesTags: [{ type: 'Spaces', id: 'LIST' }],
    }),
  }),
});

export const {
  useLoadCanvasStateQuery,
  useSaveCanvasStateMutation,
  useListSpacesQuery,
  useDeleteImageMutation,
  useDeleteSpaceMutation,
} = spacesApi;
