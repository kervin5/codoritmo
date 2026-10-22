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
int redondear(double x);
int truncar(double x);
char *convertiratexto(double valor);
char *mayusculas(const char *s);
char *minusculas(const char *s);
char *subcadena(const char *s, int desde, int cuantos);
char *get_aux_buffer(void);

int main() {
	char s[MAX_STRLEN] = "";
	double x = 0;
	x = 1.5;
	printf("%s\n", convertiratexto(sqrt(x)));
	printf("%s\n", convertiratexto(fabs(x)));
	printf("%s\n", convertiratexto(log(x)));
	printf("%s\n", convertiratexto(exp(x)));
	printf("%s\n", convertiratexto(sin(x)));
	printf("%s\n", convertiratexto(cos(x)));
	printf("%s\n", convertiratexto(tan(x)));
	printf("%s\n", convertiratexto(asin(x)));
	printf("%s\n", convertiratexto(acos(x)));
	printf("%s\n", convertiratexto(atan(x)));
	printf("%i\n", redondear(x));
	printf("%i\n", truncar(x));
	printf("%i\n", (rand()%15));
	strcpy(s, "Hola");
	printf("%i\n", (int)strlen(s));
	printf("%s\n", minusculas(s));
	printf("%s\n", mayusculas(s));
	printf("%s\n", subcadena(s, 1, 2));
	printf("%s\n", strcat(strcpy(get_aux_buffer(), s), " Mundo"));
	printf("%s\n", strcat(strcpy(get_aux_buffer(), "Mundo "), s));
	printf("%s\n", convertiratexto(atof("15.5")));
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

/* Las letras acentuadas y la ñ (UTF-8) también cambian. */
char *mayusculas(const char *s) {
	char *buffer = get_aux_buffer();
	int i;
	for (i=0; s[i]!='\0' && i<MAX_STRLEN-1; ++i) {
		buffer[i] = (char)toupper((unsigned char)s[i]);
		if ((unsigned char)s[i]==0xC3 && s[i+1]!='\0' && i<MAX_STRLEN-2) {
			unsigned char c = (unsigned char)s[++i];
			if (c>=0xA0 && c<=0xBE && c!=0xB7) c -= 0x20;
			buffer[i] = (char)c;
		}
	}
	buffer[i] = '\0';
	return buffer;
}

char *minusculas(const char *s) {
	char *buffer = get_aux_buffer();
	int i;
	for (i=0; s[i]!='\0' && i<MAX_STRLEN-1; ++i) {
		buffer[i] = (char)tolower((unsigned char)s[i]);
		if ((unsigned char)s[i]==0xC3 && s[i+1]!='\0' && i<MAX_STRLEN-2) {
			unsigned char c = (unsigned char)s[++i];
			if (c>=0x80 && c<=0x9E && c!=0x97) c += 0x20;
			buffer[i] = (char)c;
		}
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

/* Como redon() de PSeInt: redondea alejándose de cero (-2.5 da -3). */
int redondear(double x) {
	return (int)(x<0 ? x-0.5 : x+0.5);
}

/* Como trunc() de PSeInt: un valor a menos de 1e-11 del entero siguiente */
/* se trunca a ese entero, así trunc(100*0.57) da 57 y no 56. */
int truncar(double x) {
	int t = (int)x;
	if (t+1-x<1e-11) return t+1;
	if (t-1-x>-1e-11) return t-1;
	return t;
}
