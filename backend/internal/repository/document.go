package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"pe-portal/internal/model"
)

type DocumentRepository struct {
	pool *pgxpool.Pool
}

func NewDocumentRepository(pool *pgxpool.Pool) *DocumentRepository {
	return &DocumentRepository{pool: pool}
}

func (r *DocumentRepository) List(ctx context.Context, fileType, category string, groupID, projectID, modelID *uuid.UUID, search string) ([]model.Document, error) {
	query := `
		SELECT d.id, d.title, d.file_name, d.file_path, d.file_size, d.mime_type, d.file_type,
		       d.category, d.tags, d.uploaded_by, u.full_name as uploader_name,
		       d.group_part_id, gp.name as group_part_name,
		       d.project_id, d.model_id, d.version, d.is_archived, d.created_at, d.updated_at
		FROM documents d
		LEFT JOIN users u ON d.uploaded_by = u.id
		LEFT JOIN group_parts gp ON d.group_part_id = gp.id
		WHERE d.deleted_at IS NULL
		  AND ($1 = '' OR d.file_type = $1)
		  AND ($2 = '' OR d.category = $2)
		  AND ($3::uuid IS NULL OR d.group_part_id = $3)
		  AND ($4::uuid IS NULL OR d.project_id = $4)
		  AND ($5::uuid IS NULL OR d.model_id = $5)
		  AND ($6 = '' OR d.title ILIKE '%' || $6 || '%' OR d.file_name ILIKE '%' || $6 || '%')
		ORDER BY d.created_at DESC
	`

	rows, err := r.pool.Query(ctx, query, fileType, category, groupID, projectID, modelID, search)
	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}
	defer rows.Close()

	docs := []model.Document{}
	for rows.Next() {
		var d model.Document
		err := rows.Scan(
			&d.ID, &d.Title, &d.FileName, &d.FilePath, &d.FileSize, &d.MimeType, &d.FileType,
			&d.Category, &d.Tags, &d.UploadedBy, &d.UploaderName,
			&d.GroupPartID, &d.GroupPartName,
			&d.ProjectID, &d.ModelID, &d.Version, &d.IsArchived, &d.CreatedAt, &d.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, nil
}

func (r *DocumentRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Document, error) {
	query := `
		SELECT d.id, d.title, d.file_name, d.file_path, d.file_size, d.mime_type, d.file_type,
		       d.category, d.tags, d.uploaded_by, u.full_name as uploader_name,
		       d.group_part_id, gp.name as group_part_name,
		       d.project_id, d.model_id, d.version, d.is_archived, d.created_at, d.updated_at
		FROM documents d
		LEFT JOIN users u ON d.uploaded_by = u.id
		LEFT JOIN group_parts gp ON d.group_part_id = gp.id
		WHERE d.id = $1 AND d.deleted_at IS NULL
	`

	var d model.Document
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&d.ID, &d.Title, &d.FileName, &d.FilePath, &d.FileSize, &d.MimeType, &d.FileType,
		&d.Category, &d.Tags, &d.UploadedBy, &d.UploaderName,
		&d.GroupPartID, &d.GroupPartName,
		&d.ProjectID, &d.ModelID, &d.Version, &d.IsArchived, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *DocumentRepository) Create(ctx context.Context, d *model.Document) (*model.Document, error) {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	if len(d.Tags) == 0 {
		d.Tags = json.RawMessage("[]")
	}
	if d.Version == 0 {
		d.Version = 1
	}

	query := `
		INSERT INTO documents (id, title, file_name, file_path, file_size, mime_type, file_type, category, tags, uploaded_by, group_part_id, project_id, model_id, version, is_archived)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING created_at, updated_at
	`

	err := r.pool.QueryRow(ctx, query,
		d.ID, d.Title, d.FileName, d.FilePath, d.FileSize, d.MimeType, d.FileType,
		d.Category, d.Tags, d.UploadedBy, d.GroupPartID, d.ProjectID, d.ModelID, d.Version, d.IsArchived,
	).Scan(&d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create document record: %w", err)
	}

	return r.GetByID(ctx, d.ID)
}

func (r *DocumentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE documents SET deleted_at = NOW() WHERE id = $1`
	_, err := r.pool.Exec(ctx, query, id)
	return err
}
