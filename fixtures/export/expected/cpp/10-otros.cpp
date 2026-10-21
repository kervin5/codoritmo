// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<cmath>
#include<ctime>
using namespace std;

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif
// Funciones auxiliares, definidas al final
void esperar(double milisegundos);

int main() {
	cout << "\033[2J\033[H"; // secuencia ANSI: C++ estándar no puede borrar la pantalla
	cin.get(); // espera un Enter, no cualquier tecla
	esperar(100);
	esperar(1*1000);
	cout << M_PI << endl;
	return 0;
}

void esperar(double milisegundos) {
	clock_t inicio = clock();
	while (1000.0*(clock()-inicio)/CLOCKS_PER_SEC<milisegundos) {
	}
}
