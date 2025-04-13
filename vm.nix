{ lib, nixos, getExe, backend, frontend, coreutils, nix, path }:

let
  evaluated = nixos {
    virtualisation.vmVariant = {
      virtualisation.forwardPorts = [
        { host.port = 10000; guest.port = 80; }
      ];
      virtualisation.graphics = false; # Disables the qemu GUI; use `Ctrl+a x` to exit
    };
    systemd.extraConfig = ''
      DefaultStandardOutput=journal+console
      DefaultStandardError=journal+console
    '';
    systemd.services."visualizer-backend" = {
      serviceConfig = {
        ExecStart = getExe backend;
        User = "root";
        Environment = [
          "NIX_PATH=nixpkgs=${path}"
          "HOME=/root"
        ];
        WorkingDirectory = "/root";
        Restart = "always";
        RestartSec = "3";
      };
      path = [ nix coreutils ];
      wantedBy = [ "multi-user.target" ];
    };
    networking.firewall.allowedTCPPorts = [ 80 ];
    services.nginx = {
      enable = true;
      virtualHosts."localhost" = {
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
    };
    system.stateVersion = "24.11";
  };
in
  evaluated.config.system.build.vm
