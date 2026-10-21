/* Este código fue generado por Codoritmo a partir del pseudocódigo.
   Puede que no sea completamente correcto: revíselo antes de usarlo. */

#include<stdio.h>
#include<math.h>
#include<stdbool.h>
#include<string.h>

/* Las cadenas son arreglos de char de tamaño MAX_STRLEN (incluido el
   caracter de terminación). */
#define MAX_STRLEN 256
#define MAX_BUFFERS 10
/* Funciones auxiliares, definidas al final */
char *get_aux_buffer(void);

int main() {
	double a;
	double b;
	bool c;
	bool d;
	char e[MAX_STRLEN];
	char f[MAX_STRLEN];
	a = 11;
	b = 2;
	c = true;
	d = false;
	strcpy(e, "Hola");
	strcpy(f, "Mundo");
	printf("%g\n", a+b);
	printf("%g\n", a*b);
	printf("%g\n", a/b);
	printf("%g\n", a-b);
	printf("%g\n", pow(a, b));
	printf("%g\n", fmod(a, b));
	printf("%s\n", a==b ? "VERDADERO" : "FALSO");
	printf("%s\n", a!=b ? "VERDADERO" : "FALSO");
	printf("%s\n", a<b ? "VERDADERO" : "FALSO");
	printf("%s\n", a>b ? "VERDADERO" : "FALSO");
	printf("%s\n", a<=b ? "VERDADERO" : "FALSO");
	printf("%s\n", a>=b ? "VERDADERO" : "FALSO");
	printf("%s\n", c && d ? "VERDADERO" : "FALSO");
	printf("%s\n", c || d ? "VERDADERO" : "FALSO");
	printf("%s\n", !(c && d) ? "VERDADERO" : "FALSO");
	printf("%s\n", strcat(strcpy(get_aux_buffer(), strcat(strcpy(get_aux_buffer(), e), " ")), f));
	printf("%s\n", strcmp(e, f)==0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)!=0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)<0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)>0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)<=0 ? "VERDADERO" : "FALSO");
	printf("%s\n", strcmp(e, f)>=0 ? "VERDADERO" : "FALSO");
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
