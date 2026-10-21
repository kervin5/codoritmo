/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>
#include<math.h>
#include<stdlib.h>
#include<ctype.h>
#include<string.h>

/* Las cadenas son arreglos de char de tamaño MAX_STRLEN (incluido el
   caracter de terminación). */
#define MAX_STRLEN 256
#define MAX_BUFFERS 10
/* Funciones auxiliares, definidas al final */
char *convertiratexto(double valor);
char *mayusculas(const char *s);
char *minusculas(const char *s);
char *subcadena(const char *s, int desde, int cuantos);
char *get_aux_buffer(void);

int main() {
	char s[MAX_STRLEN];
	double x;
	x = 1.5;
	printf("%g\n", sqrt(x));
	printf("%g\n", fabs(x));
	printf("%g\n", log(x));
	printf("%g\n", exp(x));
	printf("%g\n", sin(x));
	printf("%g\n", cos(x));
	printf("%g\n", tan(x));
	printf("%g\n", asin(x));
	printf("%g\n", acos(x));
	printf("%g\n", atan(x));
	printf("%i\n", (int)floor(x+0.5));
	printf("%i\n", (int)x);
	printf("%i\n", (rand()%15));
	strcpy(s, "Hola");
	printf("%i\n", (int)strlen(s));
	printf("%s\n", minusculas(s));
	printf("%s\n", mayusculas(s));
	printf("%s\n", subcadena(s, 1, 2));
	printf("%s\n", strcat(strcpy(get_aux_buffer(), s), " Mundo"));
	printf("%s\n", strcat(strcpy(get_aux_buffer(), "Mundo "), s));
	printf("%g\n", atof("15.5"));
	printf("%s\n", convertiratexto(15.5));
	return 0;
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

char *convertiratexto(double valor) {
	char *buffer = get_aux_buffer();
	sprintf(buffer, "%g", valor);
	return buffer;
}

char *mayusculas(const char *s) {
	char *buffer = get_aux_buffer();
	int i;
	for (i=0; s[i]!='\0' && i<MAX_STRLEN-1; ++i) {
		buffer[i] = (char)toupper((unsigned char)s[i]);
	}
	buffer[i] = '\0';
	return buffer;
}

char *minusculas(const char *s) {
	char *buffer = get_aux_buffer();
	int i;
	for (i=0; s[i]!='\0' && i<MAX_STRLEN-1; ++i) {
		buffer[i] = (char)tolower((unsigned char)s[i]);
	}
	buffer[i] = '\0';
	return buffer;
}

char *subcadena(const char *s, int desde, int cuantos) {
	char *buffer = get_aux_buffer();
	int largo = (int)strlen(s);
	if (desde<0) desde = 0;
	if (desde>largo) desde = largo;
	if (cuantos>largo-desde) cuantos = largo-desde;
	if (cuantos<0) cuantos = 0;
	strncpy(buffer, s+desde, cuantos);
	buffer[cuantos] = '\0';
	return buffer;
}
