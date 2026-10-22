// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<cmath>
#include<cstdio>
#include<cstring>
#include<string>
using namespace std;

// No se pudo determinar el tipo de algunas variables: se declaran como
// SIN_TIPO. Reemplácelo por el tipo adecuado (int, double, string o bool).
#define SIN_TIPO string
// Funciones auxiliares, definidas al final
string convertiratexto(double valor);

// Declaraciones adelantadas de los subprocesos
double funciondoble(double b);
void noretornanada(double a, double b);
void porreferencia(double &b);
void recibevector(SIN_TIPO v[]);
void recibematriz(SIN_TIPO m[][4]);

int main() {
	SIN_TIPO a[10] = {};
	SIN_TIPO b[3][4] = {};
	double c = 0;
	cout << convertiratexto(funciondoble(5)) << endl;
	noretornanada(3, 9);
	c = 0;
	porreferencia(c);
	cout << convertiratexto(c) << endl;
	recibevector(a);
	recibematriz(b);
	return 0;
}

double funciondoble(double b) {
	double a = 0;
	a = 2*b;
	return a;
}

void noretornanada(double a, double b) {
	cout << convertiratexto(a+b) << endl;
}

void porreferencia(double &b) {
	b = 7;
}

void recibevector(SIN_TIPO v[]) {
	cin >> v[0];
}

void recibematriz(SIN_TIPO m[][4]) {
	cin >> m[0][0];
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
