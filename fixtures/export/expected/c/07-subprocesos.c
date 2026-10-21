/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>

/* No se pudo determinar el tipo de algunas variables: se declaran como
   SIN_TIPO. Reemplácelo por el tipo adecuado (int, double, bool o char[]). */
#define SIN_TIPO double

/* Declaraciones adelantadas de los subprocesos */
double funciondoble(double b);
void noretornanada(double a, double b);
void porreferencia(double *b);
void recibevector(SIN_TIPO v[]);
void recibematriz(SIN_TIPO m[][4]);

int main() {
	SIN_TIPO a[10];
	SIN_TIPO b[3][4];
	double c;
	printf("%g\n", funciondoble(5));
	noretornanada(3, 9);
	c = 0;
	porreferencia(&c);
	printf("%g\n", c);
	recibevector(a);
	recibematriz(b);
	return 0;
}

double funciondoble(double b) {
	double a;
	a = 2*b;
	return a;
}

void noretornanada(double a, double b) {
	printf("%g\n", a+b);
}

void porreferencia(double *b) {
	(*b) = 7;
}

void recibevector(SIN_TIPO v[]) {
	scanf("%lf", &v[0]);
}

void recibematriz(SIN_TIPO m[][4]) {
	scanf("%lf", &m[0][0]);
}
