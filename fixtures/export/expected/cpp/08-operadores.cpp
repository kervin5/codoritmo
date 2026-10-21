// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<cmath>
#include<string>
using namespace std;

int main() {
	double a;
	double b;
	bool c;
	bool d;
	string e;
	string f;
	a = 11;
	b = 2;
	c = true;
	d = false;
	e = "Hola";
	f = "Mundo";
	cout << a+b << endl;
	cout << a*b << endl;
	cout << a/b << endl;
	cout << a-b << endl;
	cout << pow(a, b) << endl;
	cout << fmod(a, b) << endl;
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
