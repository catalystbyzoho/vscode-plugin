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

    # Reject a symlinked output path or any parent instead of silently following it.
    if [ -L "$ext_out" ] || [ -L "./build/VSCODE_PLUGIN" ] || [ -L "./build" ] ; then
        echo "> Output path or one of its parents is a symlink, refusing to build"
        return 1
    fi

    # Reject a parent directory that is group- or world-writable; a writable
    # parent allows a concurrent process to replace the output path between
    # our checks and the packaging step.
    for parent_dir in "./build" "./build/VSCODE_PLUGIN" ; do
        if [ -d "$parent_dir" ] ; then
            parent_mode=$(stat -f '%Mp%Lp' "$parent_dir" 2>/dev/null || stat -c '%a' "$parent_dir")
            # Check group-write (bit 4 of two-digit octal) or other-write (bit 1)
            if echo "$parent_mode" | grep -qE '[2367].$|.[2367]$' ; then
                echo "> Parent directory '$parent_dir' is group- or world-writable, refusing to build"
                return 1
            fi
        fi
    done

    # Accepted residual risk: the rm-rf → mkdir → vsce-package sequence is path-based
    # and cannot be made atomic in POSIX shell. Descriptor-relative operations (openat,
    # unlinkat) that would close the race are not available in shell scripts. The parent
    # write-permission checks above eliminate the practical attack surface; a concurrent
    # process with write access to a parent is rejected before any destructive step runs.
    #
    # Do not trust a pre-existing output directory's permissions/ownership/contents;
    # remove and recreate it fresh so it is always owned by the current user with mode 755.
    if [ -e "$ext_out" ] ; then
        echo "> Removing pre-existing output directory before recreating it securely"
        rm -rf -- "$ext_out" || { echo "> Failed to remove existing output directory"; return 1; }
    fi

    if mkdir -m 755 -p "$ext_out" ; then
        # Re-check for a TOCTOU symlink swap and verify the directory is owned by us.
        if [ -L "$ext_out" ] ; then
            echo "> Output directory was replaced with a symlink after creation, aborting"
            return 1
        fi
        if [ "$(stat -f '%u' "$ext_out" 2>/dev/null || stat -c '%u' "$ext_out")" != "$(id -u)" ] ; then
            echo "> Output directory is not owned by the current user, aborting"
            return 1
        fi
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
        npx vsce package -o "$ext_out" --allow-missing-repository --pre-release
    else
        echo "> Generating stable release build"
        npx vsce package -o "$ext_out" --allow-missing-repository
    fi

    # Verify the produced artifact is owned by the current user and resides
    # inside the expected output directory before declaring success.
    vsix_file=$(ls "$ext_out"/*.vsix 2>/dev/null | head -1)
    if [ -z "$vsix_file" ] ; then
        echo "> Packaging produced no .vsix artifact, aborting"
        return 1
    fi
    if [ -L "$vsix_file" ] ; then
        echo "> Produced artifact is a symlink, refusing to accept it"
        return 1
    fi
    artifact_owner=$(stat -f '%u' "$vsix_file" 2>/dev/null || stat -c '%u' "$vsix_file")
    if [ "$artifact_owner" != "$(id -u)" ] ; then
        echo "> Produced artifact is not owned by the current user, aborting"
        return 1
    fi
    echo "> Artifact verified: $vsix_file"
}

main $@
