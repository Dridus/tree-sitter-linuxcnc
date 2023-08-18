{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=release-22.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = inputs: inputs.flake-utils.lib.eachDefaultSystem (system:
    let
      pkgs = import inputs.nixpkgs {
        inherit system;
        overlays = [
          (self: super: {
            tree-sitter = super.tree-sitter.override (_: { webUISupport = true; });
          })
        ];
      };
    in {
      devShells.default = pkgs.mkShell {
        packages = [
          pkgs.nodejs
          pkgs.tree-sitter
          pkgs.graphviz
          pkgs.emscripten
        ];
      };
    }
  );
}
