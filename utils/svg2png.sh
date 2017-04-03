#!/bin/bash

cd "$(dirname "$0")/../asset"
find . -name \*.svg -exec convert -density 3600 -background none -resize 96x96 {} {}.png \;
#find . -name \*.svg -exec inkscape -z -e {}.png -w 96 -h 96 {} \;

