#!/bin/bash

RED='\033[1;31m'
GREEN='\033[1;32m'
BLUE='\033[1;34m'
NC='\033[0m'

OPT_POT=false
OPT_PO=false
OPT_MO=false
OPT_ZIP=false
OPT_CHECK=false

help() {
    echo -e "${BLUE}ChromaLeon Build & Translation Script${NC}"
    echo ""
    echo "Options:"
    echo "  -pot                Update .pot file with new template strings"
    echo "  -po                 Update .po files with changes from the .pot file"
    echo "  -mo                 Compile final translation files (.mo)"
    echo "  -zip                Package the extension into a .zip file"
    echo "  -c | --check        Validate the extension .zip file for errors"
    echo "  -h,  --help         Show this help menu and exit"
    echo ""
    echo "Example: ./script.sh -pot -po -mo"
    exit 0
}

if [ "$#" -eq 0 ]; then
    sleep 0.2
    clear

    echo -e "${GREEN}No arguments provided. Starting interactive mode...${NC}"
    echo "Answer with 'y' for yes or press Enter to skip (no)."
    echo "------------------------------------------------------------"

    read -p " -> Update .pot file? (y/N): " resp
    [[ "$resp" =~ ^[SsYy]$ ]] && OPT_POT=true

    read -p " -> Update .po files? (y/N): " resp
    [[ "$resp" =~ ^[SsYy]$ ]] && OPT_PO=true

    read -p " -> Compile .mo files? (y/N): " resp
    [[ "$resp" =~ ^[SsYy]$ ]] && OPT_MO=true

    read -p " -> Build ChromaLeon .zip package? (y/N): " resp
    [[ "$resp" =~ ^[SsYy]$ ]] && OPT_ZIP=true

    read -p " -> Validate ChromaLeon .zip file? (y/N): " resp
    [[ "$resp" =~ ^[SsYy]$ ]] && OPT_CHECK=true

    echo -e "------------------------------------------------------------\n"
else
    while [[ "$#" -gt 0 ]]; do
        case $1 in
            -pot) OPT_POT=true ;;
            -po) OPT_PO=true ;;
            -mo) OPT_MO=true ;;
            -zip) OPT_ZIP=true ;;
            -c|--check) OPT_CHECK=true ;;
            -h|--help) help ;;
            *) echo -e "${RED}Error: Unknown parameter: $1${NC}"; exit 1 ;;
        esac
        shift
    done
fi

if [ "$OPT_POT" = true ]; then
    echo -e "\n${BLUE}Updating .pot file...${NC}"

    xgettext --from-code=UTF-8 \
             --language=JavaScript \
             --keyword=_ \
             --output=po/chromaleon.pot \
             *.js ./utils/*.js
fi

if [ "$OPT_PO" = true ]; then
    echo -e "\n${BLUE}Updating .po files...${NC}"

    for po in po/*.po; do msgmerge --update "$po" po/chromaleon.pot; done
fi

if [ "$OPT_MO" = true ]; then
    echo -e "\n${BLUE}Compiling .mo files...${NC}"

    for lang in po/*.po; do
        lang_code=$(basename "$lang" .po)
        mkdir -p "locale/$lang_code/LC_MESSAGES"
        msgfmt "$lang" -o "locale/$lang_code/LC_MESSAGES/chromaleon.mo"
    done
fi

if [ "$OPT_ZIP" = true ]; then
    echo -e "\n${BLUE}Building ChromaLeon .zip package...${NC}"

    cp -r ./locale/zh_Hans ./locale/zh_CN
    cp -r ./po/zh_Hans.po ./po/zh_CN.po

    gnome-extensions pack ./ \
      --extra-source=templates \
      --extra-source=assets \
      --extra-source=utils \
      --extra-source=chromaleon.js \
      --extra-source=prefs.css \
      -f

    sleep 1

    rm -rf ./locale/zh_CN
    rm -rf ./po/zh_CN.po
fi

if [ "$OPT_CHECK" = true ]; then
    echo -e "\n${BLUE}Validating ChromaLeon .zip package...${NC}"

    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python -m venv venv
    fi

    source venv/bin/activate
    pip install -q -U shexli

    PYTHONFAULTHANDLER=1 shexli user-accent-colors@fabito02.shell-extension.zip
    deactivate
fi

echo -e "\n${GREEN}All tasks completed successfully!${NC}"

if [ "$OPT_PO" = true ]; then
    read -p " -> Remove translation backup files (*~)? (y/N): " resp
    [[ "$resp" =~ ^[SsYy]$ ]] && rm -f po/*~
fi
