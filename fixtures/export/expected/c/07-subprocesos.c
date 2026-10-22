/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>
#include<math.h>
#include<string.h>

/* Las cadenas son arreglos de char de tamaño MAX_STRLEN (incluido el
   caracter de terminación). */
#define MAX_STRLEN 256
#define MAX_BUFFERS 10
/* No se pudo determinar el tipo de algunas variables: se declaran como
   SIN_TIPO. Reemplácelo por el tipo adecuado (int, double, bool o char[]). */
#define SIN_TIPO double
/* Funciones auxiliares, definidas al final */
char *convertiratexto(double valor);
char *get_aux_buffer(void);

/* Declaraciones adelantadas de los subprocesos */
double funciondoble(double b);
void noretornanada(double a, double b);
void porreferencia(double *b);
void recibevector(SIN_TIPO v[]);
void recibematriz(SIN_TIPO m[][4]);

int main() {
	SIN_TIPO a[10] = {0};
	SIN_TIPO b[3][4] = {0};
	double c = 0;
	printf("%s\n", convertiratexto(funciondoble(5)));
	noretornanada(3, 9);
	c = 0;
	porreferencia(&c);
	printf("%s\n", convertiratexto(c));
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
	printf("%s\n", convertiratexto(a+b));
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

/* Devuelve uno de varios buffers estáticos, rotando, para guardar
   cadenas temporales (concatenaciones, resultados de funciones). */
char *get_aux_buffer(void) {
	static char buffers[MAX_BUFFERS][MAX_STRLEN];
	static int actual = 0;
	actual = (actual+1)%MAX_BUFFERS;
	buffers[actual][0] = '\0';
	return buffers[actual];
}

/* Escribe un número como PSeInt: redondeado a 10 decimales, sin ceros
   finales y sin notación exponencial. */
char *convertiratexto(double valor) {
	char *buffer = get_aux_buffer();
	int largo;
	if (valor==floor(valor)) {
		snprintf(buffer, MAX_STRLEN, "%.0f", valor);
	} else {
		snprintf(buffer, MAX_STRLEN, "%.10f", valor);
		largo = (int)strlen(buffer);
		while (buffer[largo-1]=='0') buffer[--largo] = '\0';
		if (buffer[largo-1]=='.') buffer[--largo] = '\0';
	}
	if (strcmp(buffer, "-0")==0) strcpy(buffer, "0");
	return buffer;
}
