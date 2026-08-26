# Change Log

All notable changes to the "Catalyst" extension will be documented in this file.

## [v1.0.0] (10-02-2026)

- **Multi Org Support:** Users can now choose their org when initialising a project on an empty workspace.
- **AppSail Support:** Added support to Initialize, Serve and Deploy AppSail. Project view now displays the deployed AppSails in development environment.
- **Job Function Support:** Added support to Initialize, Serve, Debug, Deploy and Pull Job functions.
- **Runtime Support:** 
    - **Python 3.9** Added support for `python3.9` runtime.
    - **Java 11, 17** Added support for `Java 11` and `Java 17` runtimes.
- **UI/UX Changes:**
    - **Add buttons:** Function add and Client Add buttons are now moved from the Catalyst config view to their respective view sections.
    - **Debug button:** The `Run/Debug` button is now split and displayed as `Serve` and `Debug` for the function. Both `HTTP functions` and `Non-HTTP functions` support this option. The earlier `zcatalyst.debug` setting is deprecated.
    - **Copy URL Button:** For HTTP components, a new button is added using which the serve url of the component can be copied to the clip board.
    - **Open Button:** Behavior of the `Open` button is modified, clicking the `Open` button reveal the relevant directory or file in the explorer view.
    - **Terminal enhancement:** Spinners and loaders are now displayed in the terminal views.
- **Extension Settings:**
    - `zcatalyst.debug` is now deprecated and removed.
    - `zcatalyst.python_3_9` configure python 3.9 bin path.
    - `zcatalyst.java8` configure Java 8 bin path.
    - `zcatalyst.java11` configure Java 11 bin path.
    - `zcatalyst.java17` configure Java 17 bin path.
    - `zcatalyst.node12` configure node.js 12 bin path.
    - `zcatalyst.node14` configure node.js 14 bin path.
    - `zcatalyst.node16` configure node.js 16 bin path.
    - `zcatalyst.node18` configure node.js 18 bin path.
    - `zcatalyst.node20` configure node.js 20 bin path.
    - `zcatalyst.chromeExecutable` configure chrome executable path for browser logic functions.
    - `zcatalyst.chromeDriverExecutable` configure chrome driver executable path for browser logic functions.
- **JSON Schema:** Update the JSON schema of catalyst config files to support latest configurations.
