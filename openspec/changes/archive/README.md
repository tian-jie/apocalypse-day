# OpenSpec Archive Format

归档后的 change 使用精简双文件结构：

- `proposal.md`：保留原始变更提案，便于快速理解目标与范围。
- `design-spec.md`：将 `design.md` 与 `specs/**/*.md` 合并到同一文件，便于在单文档内渐进式披露设计与规范细节。

每个归档目录使用 `YYYY-MM-DD-<change-name>` 命名，并且目录内只保留上述两个文件。