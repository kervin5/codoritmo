// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<cmath>
#include<cstdio>
#include<cstring>
#include<string>
using namespace std;

// Funciones auxiliares, definidas al final
string convertiratexto(double valor);

int main() {
	double c = 0;
	c = 0;
	while (c<=10) {
		c = c+1;
		cout << convertiratexto(c) << endl;
	}
	c = 0;
	do {
		c = c+1;
		cout << convertiratexto(c) << endl;
	} while (c!=10);
	c = 0;
	do {
		c = c+1;
		cout << convertiratexto(c) << endl;
	} while (c<10);
	if (c==10) {
		cout << "Si" << endl;
	}
	if (c==10) {
		cout << "Si" << endl;
	} else {
		cout << "No" << endl;
	}
	return 0;
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
