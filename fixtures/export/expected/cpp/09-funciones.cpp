// Este código fue generado por Codoritmo a partir del pseudocódigo.
// Puede que no sea completamente correcto: revíselo antes de usarlo.

#include<iostream>
#include<cmath>
#include<cstdlib>
#include<cctype>
#include<sstream>
#include<string>
using namespace std;

// Funciones auxiliares, definidas al final
string convertiratexto(double valor);
string mayusculas(string s);
string minusculas(string s);

int main() {
	string s;
	double x;
	x = 1.5;
	cout << sqrt(x) << endl;
	cout << fabs(x) << endl;
	cout << log(x) << endl;
	cout << exp(x) << endl;
	cout << sin(x) << endl;
	cout << cos(x) << endl;
	cout << tan(x) << endl;
	cout << asin(x) << endl;
	cout << acos(x) << endl;
	cout << atan(x) << endl;
	cout << int(floor(x+0.5)) << endl;
	cout << int(x) << endl;
	cout << (rand()%15) << endl;
	s = "Hola";
	cout << int(s.size()) << endl;
	cout << minusculas(s) << endl;
	cout << mayusculas(s) << endl;
	cout << s.substr(1, 2) << endl;
	cout << (s+" Mundo") << endl;
	cout << (string("Mundo ")+s) << endl;
	cout << atof("15.5") << endl;
	cout << convertiratexto(15.5) << endl;
	return 0;
}

string convertiratexto(double valor) {
	ostringstream salida;
	salida << valor;
	return salida.str();
}

string mayusculas(string s) {
	for (size_t i=0; i<s.size(); ++i) {
		s[i] = char(toupper((unsigned char)s[i]));
	}
	return s;
}

string minusculas(string s) {
	for (size_t i=0; i<s.size(); ++i) {
		s[i] = char(tolower((unsigned char)s[i]));
	}
	return s;
}
