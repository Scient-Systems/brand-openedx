.PHONY: build
build:
	rm -rf dist && mkdir dist
	npm run build-tokens
	npm run build-scss
	# Second palettes, derived from dist/ (see tools/build-palette.mjs).
	node tools/build-palette.mjs scient
