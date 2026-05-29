// Package openapi validates and inspects OpenAPI documents (api.yaml).
package openapi

import (
	"fmt"
	"strings"

	"github.com/pb33f/libopenapi"
	validator "github.com/pb33f/libopenapi-validator"
)

// Validate は OpenAPI ドキュメント (YAML/JSON) を構文・モデル・スキーマの順に検証する。
// 不正な場合は人が読めるメッセージを持つ error を返す。
func Validate(data []byte) error {
	doc, err := libopenapi.NewDocument(data)
	if err != nil {
		return fmt.Errorf("OpenAPI として読み込めません: %w", err)
	}

	// モデル構築 (参照解決・型不整合などを検出)。
	if _, err := doc.BuildV3Model(); err != nil {
		return fmt.Errorf("OpenAPI モデルが不正です: %w", err)
	}

	// OpenAPI 3.0/3.1 スキーマに対する検証。
	v, vErrs := validator.NewValidator(doc)
	if len(vErrs) > 0 {
		return fmt.Errorf("バリデータの初期化に失敗しました:\n%s", joinErrors(toStrings(vErrs)))
	}
	if ok, docErrs := v.ValidateDocument(); !ok {
		var msgs []string
		for _, e := range docErrs {
			base := e.Message
			if e.Reason != "" {
				base += ": " + e.Reason
			}
			msgs = append(msgs, base)
			// 具体的なスキーマ違反箇所があれば付加する (汎用文言は除く)。
			for _, sv := range e.SchemaValidationErrors {
				if sv.Reason != "" && sv.Reason != "validation failed" {
					msgs = append(msgs, "  · "+sv.Reason)
				}
			}
		}
		return fmt.Errorf("OpenAPI スキーマ検証に失敗しました:\n%s", joinErrors(msgs))
	}
	return nil
}

// Title は OpenAPI ドキュメントの info.title を返す。取得できなければ空文字。
func Title(data []byte) string {
	doc, err := libopenapi.NewDocument(data)
	if err != nil {
		return ""
	}
	model, err := doc.BuildV3Model()
	if err != nil || model == nil || model.Model.Info == nil {
		return ""
	}
	return model.Model.Info.Title
}

func toStrings(errs []error) []string {
	out := make([]string, len(errs))
	for i, e := range errs {
		out[i] = e.Error()
	}
	return out
}

func joinErrors(msgs []string) string {
	for i, m := range msgs {
		msgs[i] = "  - " + m
	}
	return strings.Join(msgs, "\n")
}
