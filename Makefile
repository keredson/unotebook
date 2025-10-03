build:
	cd ui && yarn build

install: build
	mpremote cp unotebook.py unotebook.js.gz :/lib/