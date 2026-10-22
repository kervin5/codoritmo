// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<cmath>
#include<ctime>
#include<cstdio>
#include<cstring>
#include<string>
using namespace std;

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif
// Funciones auxiliares, definidas al final
void esperar(double milisegundos);
string convertiratexto(double valor);

int main() {
	cout << "\033[2J\033[H"; // secuencia ANSI: C++ estándar no puede borrar la pantalla
	cin.get(); // espera un Enter, no cualquier tecla
	esperar(100);
	esperar(1*1000);
	cout << convertiratexto(M_PI) << endl;
	return 0;
}

void esperar(double milisegundos) {
	clock_t inicio = clock();
	while (1000.0*(clock()-inicio)/CLOCKS_PER_SEC<milisegundos) {
	}
}

// Escribe un número como PSeInt: redondeado a 10 decimales, sin ceros
// finales y sin notación exponencial.
string convertiratexto(double valor) {
	char buffer[400];
	if (valor==floor(valor)) {
		snprintf(buffer, sizeof buffer, "%.0f", valor);
	} else {
		snprintf(buffer, sizeof buffer, "%.10f", valor);
		size_t largo = strlen(buffer);
		while (buffer[largo-1]=='0') buffer[--largo] = '\0';
		if (buffer[largo-1]=='.') buffer[--largo] = '\0';
	}
	if (strcmp(buffer, "-0")==0) return "0";
	return buffer;
}
