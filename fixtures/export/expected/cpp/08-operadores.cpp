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
	double a = 0;
	double b = 0;
	bool c = false;
	bool d = false;
	string e;
	string f;
	a = 11;
	b = 2;
	c = true;
	d = false;
	e = "Hola";
	f = "Mundo";
	cout << convertiratexto(a+b) << endl;
	cout << convertiratexto(a*b) << endl;
	cout << convertiratexto(a/b) << endl;
	cout << convertiratexto(a-b) << endl;
	cout << convertiratexto(pow(a, b)) << endl;
	cout << convertiratexto(fmod(a, b)) << endl;
	cout << (a==b ? "VERDADERO" : "FALSO") << endl;
	cout << (a!=b ? "VERDADERO" : "FALSO") << endl;
	cout << (a<b ? "VERDADERO" : "FALSO") << endl;
	cout << (a>b ? "VERDADERO" : "FALSO") << endl;
	cout << (a<=b ? "VERDADERO" : "FALSO") << endl;
	cout << (a>=b ? "VERDADERO" : "FALSO") << endl;
	cout << (c && d ? "VERDADERO" : "FALSO") << endl;
	cout << (c || d ? "VERDADERO" : "FALSO") << endl;
	cout << (!(c && d) ? "VERDADERO" : "FALSO") << endl;
	cout << e+" "+f << endl;
	cout << (e==f ? "VERDADERO" : "FALSO") << endl;
	cout << (e!=f ? "VERDADERO" : "FALSO") << endl;
	cout << (e<f ? "VERDADERO" : "FALSO") << endl;
	cout << (e>f ? "VERDADERO" : "FALSO") << endl;
	cout << (e<=f ? "VERDADERO" : "FALSO") << endl;
	cout << (e>=f ? "VERDADERO" : "FALSO") << endl;
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
