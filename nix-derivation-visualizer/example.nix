let
  pkgs = import <nixpkgs> { };
in
  pkgs.runCommand "foo" {
    nativeBuildInputs = [ pkgs.gcc ];
    mainSource = ''
      #include <iostream>
      int main(int argc, const char **argv) {
          std::cout << "Hola Mundo";
      }
    '';
  } ''
    echo "$mainSource" > main.cc
    cc ./main.cc -l "stdc++" -o "$out"
  '' 