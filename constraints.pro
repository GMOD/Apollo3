%gen_enforced_dependency(WorkspaceCwd, '@jbrowse/core', '^2.6.3', _) :-
%  workspace_has_dependency(WorkspaceCwd, '@jbrowse/core', _, _).
%gen_enforced_dependency(WorkspaceCwd, 'typescript', '^5.1.6', devDependencies) :-
%  workspace_has_dependency(WorkspaceCwd, 'typescript', _, devDependencies).

gen_enforced_dependency(WorkspaceCwd, DependencyIdent, DependencyRange2, DependencyType) :-
  workspace_has_dependency(WorkspaceCwd, DependencyIdent, DependencyRange, DependencyType),
  workspace_has_dependency(OtherWorkspaceCwd, DependencyIdent, DependencyRange2, DependencyType2),
  DependencyRange \= DependencyRange2.
