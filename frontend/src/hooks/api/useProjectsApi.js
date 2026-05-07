import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createProject, deleteProject, listProjects, updateProject } from '../../services/projectService';

const PROJECT_KEYS = {
  all: ['projects'],
};

export function useProjectsQuery() {
  return useQuery({
    queryKey: PROJECT_KEYS.all,
    queryFn: async () => {
      const data = await listProjects();
      return data.projects || [];
    },
  });
}

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all }),
  });
}

export function useUpdateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }) => updateProject(id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all }),
  });
}

export function useDeleteProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECT_KEYS.all }),
  });
}
