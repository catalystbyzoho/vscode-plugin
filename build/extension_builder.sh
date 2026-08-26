main() {
    # echo ">> test node from scrip"
    # sh -c env -i HOME=$HOME PATH=/usr/node/v22.5.1/bin:/usr/bin:/bin node --version
    echo "> Node version"
    node -v
    echo
    echo "> Npm verson"
    npm -v
    echo
    
    if npm install --ignore-scripts ; then
        echo "> NPM installed successful"
    else
        echo "> NPM install failed."
        return 1
    fi

    ext_out="./build/VSCODE_PLUGIN/output"
    if mkdir -m 755 -p $ext_out ; then 
        echo "> Output directory successfully created, with the following permission"
        echo
        ls -la "./build"
        echo
        ls -la "./build/VSCODE_PLUGIN"
        echo
    else 
        echo "> Output directory creation failed"
        return 1
    fi
    pre_release=$1

    if [[ $pre_release == "true" ]] ; then
        echo "> Generating pre release version build"
        npx vsce package -o $ext_out --allow-missing-repository --pre-release
    else
        echo "> Generating stable release build"
        npx vsce package -o $ext_out --allow-missing-repository
    fi
}

main $@
