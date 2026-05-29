.PHONY: build web go dev clean

# フロントエンド (Vite) をビルドして internal/server/dist に出力し、
# Go バイナリに embed してビルドする。
build: web go

web:
	cd web && npm install && npm run build

# バイナリは bin/specs に出力する (仕様書ディレクトリ specs/ との名前衝突を避ける)。
go:
	go build -o bin/specs .

# フロント開発サーバ (5173)。/api は Go サーバ (8787) にプロキシされるので、
# 別ターミナルで `./bin/specs serve` を起動しておくこと。
dev:
	cd web && npm run dev

clean:
	rm -rf bin internal/server/dist web/node_modules
