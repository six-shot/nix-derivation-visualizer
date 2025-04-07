{
  nixpkgs ? import <nixpkgs> { },
}:

let
  pkgs = nixpkgs;
  src = ./nix-derivative-frontend/nix-derivative-frontend;
  inherit (pkgs) buildNpmPackage importNpmLock;
  inherit (pkgs) python3Packages;
  inherit (python3Packages) buildPythonPackage;

in

rec {

  frontend = buildNpmPackage {
    pname = "frontend";
    version = "0.0.0";

    inherit src;

    npmDeps = pkgs.importNpmLock {
      npmRoot = src;
    };

    npmConfigHook = pkgs.importNpmLock.npmConfigHook;
      postInstall = ''
            echo "Here's the postInstall hook!!!" >&2
            cp -r dist/* "$out"/lib/node_modules/nix-derivative-frontend/
        '';
  };
  backend = buildPythonPackage {
    pname = "backend";
    version = "0.0.0";
    pyproject = true;
    src = ./nix-derivation-visualizer;
    build-system = [
      pkgs.python3Packages.setuptools
    ];
    dependencies = with python3Packages; [
      flask
      networkx
      pydot
      flask-cors
    ];
    meta.mainProgram = "drv-visualizer-backend";
  };
  vm =
    let
      evaluated = pkgs.nixos {
        virtualisation.vmVariant = {
          virtualisation.forwardPorts = [
            {
              host.port = 10000;
              guest.port = 80;
            }
          ];
          virtualisation.graphics = false; # Disables the qemu GUI; use `Ctrl+a x` to exit
        
        };
          systemd.extraConfig = ''
            DefaultStandardOutput=journal+console
            DefaultStandardError=journal+console
          '';
        systemd.services = {
        "visualizer-backend" = {
            serviceConfig = {
                ExecStart = pkgs.lib.getExe backend;
                User = "root";
                Environment = [
                  "NIX_PATH=nixpkgs=${pkgs.path}"
                  "HOME=/root"
                ];
            };
            path = [
                pkgs.nix
                pkgs.coreutils
            ];
            wantedBy = [ "multi-user.target" ];
            serviceConfig.WorkingDirectory = "/root";
            serviceConfig.Restart = "always";
            serviceConfig.RestartSec = "3";
        };
    };
        networking.firewall.allowedTCPPorts = [ 80 ];
        services.nginx.enable = true;
        services.nginx.virtualHosts."localhost" = {
          default = true;
          locations = {
            "/" = {
              root = "${frontend}/lib/node_modules/nix-derivative-frontend";
            };
            "/convert" = {
              proxyPass = "http://localhost:5000";
            };
          };
        };
        system.stateVersion = "24.11";
      };
    in
    evaluated.config.system.build.vm;
}
